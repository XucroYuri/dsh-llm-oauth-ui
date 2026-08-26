# dsh-llm-oauth-ui PRD

## Problem Statement

DSH 后端已有 authorization/credentials 能力，但 Web UI 缺少 OAuth 登录入口，
导致 OpenAI/xAI/GitHub Copilot 等订阅制模型难以在 DSH 中直接使用。

## Goals

- 在 DSH Web Models 页面提供 OAuth 登录按钮。
- 对接 ctx.authorization 流程。
- 登录后凭据持久化到 ctx.credentials。

## Non-Goals

- 不实现 OAuth 协议本身。
- 不修改 DSH 核心 authorization seam。
