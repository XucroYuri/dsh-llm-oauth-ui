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
      const server = createServer(async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`)
        if (url.pathname === '/api/flows') {
          const flows = authorization.list().map(f => ({ key: f.key, methods: f.methods.map(m => m.id) }))
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(flows))
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
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(obj))
          return
        }
        if (url.pathname === '/') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>DSH OAuth UI</title></head>
<body>
<h1>DSH OAuth UI</h1>
<p>Flows and login status. Interactive login is currently available via CLI:
<code>dsh --profile oauth-dev oauth login &lt;provider&gt;</code></p>
<h2>Status</h2>
<pre id="status">Loading...</pre>
<h2>Flows</h2>
<pre id="flows">Loading...</pre>
<script>
async function load(){
  const s = await fetch('/api/status').then(r=>r.json());
  document.getElementById('status').textContent = JSON.stringify(s, null, 2);
  const f = await fetch('/api/flows').then(r=>r.json());
  document.getElementById('flows').textContent = JSON.stringify(f, null, 2);
}
load();
</script>
</body></html>`)
          return
        }
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
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
