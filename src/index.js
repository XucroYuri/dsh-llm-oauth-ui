// Native DSH Cordis plugin for OAuth login status.
export const name = 'dsh-llm-oauth-ui'
export const description = 'OAuth login status and future Web UI support for DSH'
export const inject = ['credentials']

const KNOWN = ['openai', 'xai', 'github-copilot', 'google', 'anthropic']

export async function apply(ctx) {
  const args = ctx.get('cmdlineArgs')?.get() ?? []
  if (args[0] !== 'oauth' && args[0] !== 'llm-oauth-ui') return

  const exit = ctx.get('appExit')
  const finish = (code) => { if (exit) exit(code) }

  try {
    const command = args[1] || 'status'
    if (command !== 'status') {
      console.error(`Unknown command: ${command}`)
      finish(2); return
    }

    const credentials = ctx.get('credentials')
    if (!credentials) {
      console.error('dsh-llm-oauth-ui requires credentials service.')
      finish(1); return
    }

    const records = await credentials.listRecords()
    const byId = new Map()
    for (const r of records) {
      const key = r.key
      if (key && key.startsWith('llm-pi-ai/')) byId.set(key.slice('llm-pi-ai/'.length), r.kind || 'unknown')
    }

    console.log('OAuth provider login status (based on stored credential records):')
    for (const provider of KNOWN) {
      const kind = byId.get(provider)
      if (kind) console.log(`  ${provider}: configured (${kind})`)
      else console.log(`  ${provider}: not configured`)
    }
    if (byId.size === 0) {
      console.log('\nNo OAuth grants found yet.')
      console.log('Use the DSH Web Models page to sign in interactively (future dsh-llm-oauth-ui feature).')
    }
    finish(0)
  } catch (error) {
    console.error('dsh-llm-oauth-ui failed:', error)
    finish(1)
  }
}
