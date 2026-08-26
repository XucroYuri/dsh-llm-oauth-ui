# dsh-llm-oauth-ui

![CI](https://github.com/XucroYuri/dsh-llm-oauth-ui/actions/workflows/ci.yml/badge.svg) ![License](https://img.shields.io/github/license/XucroYuri/dsh-llm-oauth-ui)

DeepSeek Harness 的 OAuth 登录状态查询与未来 Web UI 支持。

> 状态：稳定

## 功能特性

- 显示 OAuth 供应商登录状态
- 读取 DSH 凭据记录
- 原生 Cordis 命令插件
- 为交互式 Web UI 预留

## 环境要求

- DeepSeek Harness (DSH) 0.1.1+
- OpenCode CLI（可选，用于 sync/catalog/bridge 功能）
- Node.js 22+
- Python 3.12+（仅用于备用 CLI 测试）

## 安装

将插件添加到 DSH profile：

```bash
cd ~/.dsh/profiles/tools
npm install @xucroyuri/dsh-llm-oauth-ui


Or install directly from GitHub:

```bash
npm install github:XucroYuri/dsh-llm-oauth-ui
```
```

然后在 `cordis.patch.yml` 中添加：

```yaml
- insert:
    - id: llm-oauth-ui
      name: '@xucroyuri/dsh-llm-oauth-ui'
```

## 使用方法

```bash
dsh --profile tools oauth status
dsh --profile tools oauth list
dsh --profile tools oauth login openai-codex
dsh --profile tools oauth logout openai-codex
```

## 开发

```bash
node --check src/index.js
PYTHONPATH=src python3 -m unittest discover -s tests -p 'test_*.py' -v
```

## 许可证

MIT


## 相关插件

- [dsh-opencode-sync](https://github.com/XucroYuri/dsh-opencode-sync)
- [dsh-provider-catalog](https://github.com/XucroYuri/dsh-provider-catalog)
- [dsh-model-manager](https://github.com/XucroYuri/dsh-model-manager)
- [dsh-llm-oauth-ui](https://github.com/XucroYuri/dsh-llm-oauth-ui)
- [dsh-opencode-bridge](https://github.com/XucroYuri/dsh-opencode-bridge)


## 文档

- [CHANGELOG.md](CHANGELOG.md)
- [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)
- [SECURITY.zh.md](SECURITY.zh.md)
- [AUTHORS.md](AUTHORS.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)


## 测试

```bash
npm test
npm run smoke
npm run pack:check
```


## 配置

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--host` | `127.0.0.1` | 绑定地址 |
| `--port` | `4098` | Web 仪表盘端口 |
| `--token` | 空 | API Bearer Token |


## 路线图

- 发布到 npm
- 集成 DSH 主 Web UI
- 完整 tool-call 协议支持
- 更多模型发现来源


## 示例

参见 [examples/](examples/) 获取可运行示例。


## 支持

如果你觉得这个项目有用，欢迎 [赞助](https://github.com/sponsors/XucroYuri)。
