// Native DSH Cordis plugin for OAuth status and interactive CLI login.
import { createServer } from 'node:http'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

export const name = 'dsh-llm-oauth-ui'
export const description = 'OAuth login status and interactive login for DSH'
export const inject = ['credentials', 'authorization']

const KNOWN = ['openai', 'xai', 'github-copilot', 'google', 'anthropic']

async function promptUser(prompt) {
  const rl = createInterface({ input, output })
  try {
    if (prompt.kind === 'select') {
      console.log(prompt.message)
      prompt.options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt.label}`))
      const answer = await rl.question('Select: ')
      const idx = Number(answer) - 1
      const opt = prompt.options[idx]
      if (!opt) throw new Error('invalid selection')
      return opt.id
    }
    const answer = await rl.question(`${prompt.message}${prompt.placeholder ? ` (${prompt.placeholder})` : ''}: `)
    return answer
  } finally {
    rl.close()
  }
}

export async function apply(ctx) {
  const args = ctx.get('cmdlineArgs')?.get() ?? []
  if (args[0] !== 'oauth' && args[0] !== 'llm-oauth-ui') return

  const exit = ctx.get('appExit')
  const finish = (code) => { if (exit) exit(code) }

  try {
    const command = args[1] || 'status'
    const json = args.includes('--json')

    if (command === 'list') {
      const authorization = ctx.get('authorization')
      if (!authorization) {
        console.error('authorization service is not mounted in this profile')
        finish(1); return
      }
      await new Promise(r => setTimeout(r, 200))
      const flows = authorization.list()
      if (json) {
        console.log(JSON.stringify(flows.map(f => ({ key: f.key, methods: f.methods.map(m => m.id) })), null, 2))
      } else if (flows.length === 0) {
        console.log('No authorization flows available.')
      } else {
        for (const flow of flows) {
          const methods = flow.methods.map(m => m.id).join(', ')
          console.log(`${flow.key}  [${methods}]`)
        }
      }
      finish(0); return
    }

    if (command === 'status') {
      const credentials = ctx.get('credentials')
      const records = await credentials.listRecords()
      const byId = new Map()
      for (const r of records) {
        if (r.key && r.key.startsWith('llm-pi-ai/')) byId.set(r.key.slice('llm-pi-ai/'.length), r.kind || 'unknown')
      }
      if (json) {
        const obj = {}
        for (const provider of KNOWN) obj[provider] = byId.get(provider) || null
        console.log(JSON.stringify(obj, null, 2))
      } else {
        console.log('OAuth provider login status:')
        for (const provider of KNOWN) {
          const kind = byId.get(provider)
          if (kind) console.log(`  ${provider}: configured (${kind})`)
          else console.log(`  ${provider}: not configured`)
        }
        if (byId.size === 0) {
          console.log('\nNo OAuth grants found yet.')
          console.log('Try: dsh --profile tools oauth login openai')
        }
      }
      finish(0); return
    }

    if (command === 'login') {
      const provider = args[2]
      if (!provider) {
        console.error('Usage: dsh --profile tools oauth login <provider> [--method oauth|api-key]')
        finish(2); return
      }
      const authorization = ctx.get('authorization')
      if (!authorization) {
        console.error('authorization service is not mounted in this profile')
        finish(1); return
      }
      // Let late-binding authorization flow registrations settle.
      await new Promise(r => setTimeout(r, 200))
      const key = `llm-pi-ai/${provider}`
      const entry = authorization.describe(key)
      if (!entry) {
        console.error(`No authorization flow registered for ${provider}`)
        console.error('Available flows:')
        for (const flow of authorization.list()) console.log(`  ${flow.key}`)
        finish(1); return
      }
      const methodIdx = args.indexOf('--method')
      const method = methodIdx >= 0 && args[methodIdx+1] ? args[methodIdx+1] : undefined
      if (method && !entry.methods.some(m => m.id === method)) {
        console.error(`Method ${method} is not offered. Available methods: ${entry.methods.map(m => m.id).join(', ')}`)
        finish(2); return
      }
      const outcome = await authorization.begin({
        key,
        ...(method ? { method } : {}),
        interaction: {
          notify: (notice) => {
            if (notice.message) console.log(notice.message)
            if (notice.url) console.log(`URL: ${notice.url}`)
            if (notice.code) console.log(`Code: ${notice.code}`)
          },
          prompt: promptUser,
        },
      })
      console.log(`Result: ${outcome.status}`)
      finish(outcome.status === 'authorized' ? 0 : 1); return
    }

    if (command === 'logout') {
      const provider = args[2]
      if (!provider) {
        console.error('Usage: dsh --profile tools oauth logout <provider>')
        finish(2); return
      }
      const credentials = ctx.get('credentials')
      await credentials.deleteRecord(`llm-pi-ai/${provider}`)
      console.log(`Logged out ${provider}`)
      finish(0); return
    }

    if (command === 'serve') {
      const portIdx = args.indexOf('--port')
      const port = portIdx >= 0 && args[portIdx+1] ? Number(args[portIdx+1]) : 4098
      const authorization = ctx.get('authorization')
      const credentials = ctx.get('credentials')
      if (!authorization || !credentials) {
        console.error('oauth serve requires authorization and credentials services')
        finish(1); return
      }
      await new Promise(r => setTimeout(r, 200))

      const loginSessions = new Map()
      let nextLoginId = 1

      function startLogin(key, method) {
        const id = `login-${nextLoginId++}`
        const session = { id, key, method, notices: [], pendingPrompt: null, status: 'running', error: null }
        loginSessions.set(id, session)
        const run = async () => {
          try {
            const outcome = await authorization.begin({
              key,
              ...(method ? { method } : {}),
              interaction: {
                notify: (notice) => { session.notices.push(notice) },
                prompt: (prompt) => new Promise((resolve, reject) => {
                  session.pendingPrompt = { ...prompt, resolve, reject }
                }),
              },
            })
            session.status = outcome.status
          } catch (error) {
            session.status = 'error'
            session.error = String(error?.message || error)
          } finally {
            if (session.pendingPrompt) {
              session.pendingPrompt.reject(new Error('flow ended'))
              session.pendingPrompt = null
            }
          }
        }
        run()
        return id
      }

      const server = createServer(async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`)
        const sendJson = (obj, status = 200) => {
          res.writeHead(status, {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,OPTIONS',
            'access-control-allow-headers': 'content-type',
          })
          res.end(JSON.stringify(obj))
        }

        if (req.method === 'OPTIONS') {
          sendJson({ ok: true })
          return
        }

        if (req.method === 'POST' && url.pathname === '/api/login') {
          let body = ''
          for await (const chunk of req) body += chunk
          let payload = {}
          try { payload = JSON.parse(body || '{}') } catch {}
          const key = payload.key
          if (!key) { sendJson({ error: 'key is required' }, 400); return }
          const id = startLogin(key, payload.method)
          sendJson({ id })
          return
        }

        if (req.method === 'POST' && url.pathname.startsWith('/api/prompt/')) {
          const id = decodeURIComponent(url.pathname.slice('/api/prompt/'.length))
          const session = loginSessions.get(id)
          if (!session || !session.pendingPrompt) { sendJson({ error: 'no pending prompt' }, 400); return }
          let body = ''
          for await (const chunk of req) body += chunk
          let payload = {}
          try { payload = JSON.parse(body || '{}') } catch {}
          const prompt = session.pendingPrompt
          session.pendingPrompt = null
          prompt.resolve(payload.answer)
          sendJson({ ok: true })
          return
        }

        if (req.method === 'GET' && url.pathname.startsWith('/api/login/')) {
          const id = decodeURIComponent(url.pathname.slice('/api/login/'.length))
          const session = loginSessions.get(id)
          if (!session) { sendJson({ error: 'not found' }, 404); return }
          const { resolve, reject, ...promptView } = session.pendingPrompt || {}
          sendJson({
            id: session.id,
            key: session.key,
            method: session.method,
            status: session.status,
            error: session.error,
            notices: session.notices,
            pendingPrompt: session.pendingPrompt ? promptView : null,
          })
          return
        }

        if (url.pathname === '/api/health') {
          sendJson({ ok: true })
          return
        }

        if (url.pathname === '/api/flows') {
          const flows = authorization.list().map(f => ({ key: f.key, methods: f.methods.map(m => m.id) }))
          sendJson(flows)
          return
        }

        if (url.pathname === '/api/status') {
          const records = await credentials.listRecords()
          const byId = {}
          for (const r of records) {
            if (r.key && r.key.startsWith('llm-pi-ai/')) byId[r.key.slice('llm-pi-ai/'.length)] = r.kind || 'unknown'
          }
          const obj = {}
          for (const provider of KNOWN) obj[provider] = byId[provider] || null
          sendJson(obj)
          return
        }

        if (url.pathname === '/') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>DSH OAuth UI</title></head>
<body>
<h1>DSH OAuth UI</h1>
<h2>Status</h2>
<pre id="status">Loading...</pre>
<h2>Flows</h2>
<pre id="flows">Loading...</pre>
<h2>Start Login</h2>
<p>Key: <input id="key" placeholder="llm-pi-ai/openai-codex" size="40"></p>
<p>Method: <input id="method" placeholder="oauth" size="20"></p>
<button onclick="startLogin()">Start Login</button>
<h2>Login Session</h2>
<pre id="login">...</pre>
<div id="promptArea"></div>
<script>
async function load(){
  const s = await fetch('/api/status').then(r=>r.json());
  document.getElementById('status').textContent = JSON.stringify(s, null, 2);
  const f = await fetch('/api/flows').then(r=>r.json());
  document.getElementById('flows').textContent = JSON.stringify(f, null, 2);
}
let currentId = null;
async function startLogin(){
  const key = document.getElementById('key').value;
  const method = document.getElementById('method').value || undefined;
  const res = await fetch('/api/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({key, method})}).then(r=>r.json());
  currentId = res.id;
  tick();
}
async function tick(){
  if (!currentId) return;
  const state = await fetch('/api/login/' + currentId).then(r=>r.json());
  document.getElementById('login').textContent = JSON.stringify(state, null, 2);
  const area = document.getElementById('promptArea');
  area.innerHTML = '';
  if (state.pendingPrompt) {
    const p = state.pendingPrompt;
    const label = document.createElement('div');
    label.textContent = p.message || 'Answer:';
    area.appendChild(label);
    if (p.kind === 'select' && p.options) {
      const sel = document.createElement('select');
      p.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.id;
        o.textContent = opt.label;
        sel.appendChild(o);
      });
      area.appendChild(sel);
      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      btn.onclick = async () => {
        await fetch('/api/prompt/' + currentId, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({answer: sel.value})});
        tick();
      };
      area.appendChild(btn);
    } else {
      const input = document.createElement('input');
      input.placeholder = p.placeholder || '';
      area.appendChild(input);
      const btn = document.createElement('button');
      btn.textContent = 'Submit';
      btn.onclick = async () => {
        await fetch('/api/prompt/' + currentId, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({answer: input.value})});
        tick();
      };
      area.appendChild(btn);
    }
  }
  if (state.status === 'running') setTimeout(tick, 1000);
}
load();
</script>
</body></html>`)
          return
        }

        sendJson({ error: 'not found' }, 404)
      })
      server.listen(port, '127.0.0.1', () => {
        console.log(`oauth web ui listening on http://127.0.0.1:${port}`)
      })
      // Keep the process alive as a long-running server.
      return
    }

    console.error(`Unknown command: ${command}`)
    finish(2)
  } catch (error) {
    console.error('dsh-llm-oauth-ui failed:', error?.message || error)
    finish(1)
  }
}
