// Minimal DSH Cordis command wrapper around the Python CLI.
import { spawnSync } from 'node:child_process'

export const name = 'dsh-llm-oauth-ui'
export const description = 'OAuth login status and future Web UI support for DSH'

export function apply(ctx) {
  const args = ctx.get('cmdlineArgs')?.get() ?? []
  if (args[0] !== 'oauth' && args[0] !== 'llm-oauth-ui') return

  const result = spawnSync('dsh-llm-oauth-ui', args.slice(1), {
    stdio: 'inherit',
    shell: false,
  })

  const exit = ctx.get('appExit')
  if (exit) exit(result.status ?? 1)
}
