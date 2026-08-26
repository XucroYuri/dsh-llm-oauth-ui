# dsh-llm-oauth-ui

![CI](https://github.com/XucroYuri/dsh-llm-oauth-ui/actions/workflows/ci.yml/badge.svg) ![License](https://img.shields.io/github/license/XucroYuri/dsh-llm-oauth-ui)

OAuth login status and future Web UI support for DeepSeek Harness.

> Status: Stable

## Features

- Show OAuth provider login status
- Read DSH credential records
- Native Cordis command plugin
- Prepared for interactive Web UI

## Requirements

- DeepSeek Harness (DSH) 0.1.1+
- OpenCode CLI (optional, for sync/catalog/bridge features)
- Node.js 22+
- Python 3.12+ (only for fallback CLI tests)

## Installation

Add the plugin to your DSH profile:

```bash
cd ~/.dsh/profiles/tools
npm install @xucroyuri/dsh-llm-oauth-ui
```

Then add to `cordis.patch.yml`:

```yaml
- insert:
    - id: llm-oauth-ui
      name: '@xucroyuri/dsh-llm-oauth-ui'
```

## Usage

```bash
dsh --profile tools oauth status
dsh --profile tools oauth list
dsh --profile tools oauth login openai-codex
dsh --profile tools oauth logout openai-codex
```

## Development

```bash
node --check src/index.js
PYTHONPATH=src python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## Related Plugins

- [dsh-opencode-sync](https://github.com/XucroYuri/dsh-opencode-sync)
- [dsh-provider-catalog](https://github.com/XucroYuri/dsh-provider-catalog)
- [dsh-model-manager](https://github.com/XucroYuri/dsh-model-manager)
- [dsh-llm-oauth-ui](https://github.com/XucroYuri/dsh-llm-oauth-ui)
- [dsh-opencode-bridge](https://github.com/XucroYuri/dsh-opencode-bridge)

## Documentation

- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## License

MIT
