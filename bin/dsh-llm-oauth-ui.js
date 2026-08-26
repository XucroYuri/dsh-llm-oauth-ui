#!/usr/bin/env node
// Standalone CLI wrapper for dsh-llm-oauth-ui.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../src/dsh_llm_oauth_ui.py', import.meta.url))
const result = spawnSync('python3', [script, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
