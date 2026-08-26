// Native DSH Cordis plugin for OAuth status and interactive CLI login.
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

    if (command === 'status') {
      const credentials = ctx.get('credentials')
      const records = await credentials.listRecords()
      const byId = new Map()
      for (const r of records) {
        if (r.key && r.key.startsWith('llm-pi-ai/')) byId.set(r.key.slice('llm-pi-ai/'.length), r.kind || 'unknown')
      }
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

    console.error(`Unknown command: ${command}`)
    finish(2)
  } catch (error) {
    console.error('dsh-llm-oauth-ui failed:', error?.message || error)
    finish(1)
  }
}
