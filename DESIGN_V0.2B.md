# LifeOS AI Gateway · 实施设计 v0.2B

状态：本地骨架可实施，云端选择待用户确认  
日期：2026-08-05  
前置文档：[`DESIGN_V0.2.md`](DESIGN_V0.2.md)

## 1. 本阶段结论

v0.2A 已经完成。v0.2B 先建立一个可替换、可测试的 AI Gateway，不让静态 PWA 直接接触 OpenAI 或 DeepSeek 的 API Key。

推荐先用 **Cloudflare Workers 免费方案做一次可达性实验**，但不把业务逻辑绑定在 Cloudflare：

- 免费方案目前包含每天 100,000 次 Worker 请求，个人工作台远低于这个量级。
- Worker Secrets 可以保存供应商 Key，值不会进入代码仓库或浏览器导出。
- 网关主要等待上游模型返回，计算逻辑很轻，适合边缘函数。
- 中国大陆移动网络对 `workers.dev` 的实际可达性不能只靠文档判断，必须在配置 Key 前用 `/health` 从手机实测。

如果手机访问不稳定，保持相同 Gateway 核心，只替换为 Supabase Edge Functions、Vercel Functions 或后续选定的国内函数服务。

官方依据：

- [Cloudflare Workers 定价与免费额度](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Supabase Edge Functions 限制](https://supabase.com/docs/guides/functions/limits)
- [Vercel Functions 限制](https://vercel.com/docs/functions/limitations)

## 2. 不可越过的边界

1. `OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 只存在于托管平台的 Secret 中。
2. PWA 只知道 Gateway 地址，不知道供应商 Key。
3. Gateway 默认拒绝没有个人访问令牌的生成请求；CORS 不是身份验证。
4. 访问令牌和供应商 Key 都不进入 Git、JSON 备份、Markdown 或错误日志。
5. 每次请求最多发送用户本次输入和显式选中的记录；不读取 Vault。
6. AI 只返回候选建议，不能直接修改事实、项目或日志。
7. 默认 `store: false`；正文不写入 Gateway 日志。
8. Provider 失败时明确失败，不自动切换供应商或重复收费。

## 3. 请求路径

```text
LifeOS PWA
  └─ POST /v1/generate
       ├─ 检查 Origin
       ├─ 检查个人 Gateway Token
       ├─ 校验任务、长度和上下文范围
       ├─ 可选限流
       ├─ OpenAI Responses API
       │    或 DeepSeek Chat Completions
       ├─ 再次校验模型 JSON
       └─ 返回统一 LifeOSAIResponse
```

健康检查 `GET /health` 不需要令牌，只返回网关版本、是否就绪和 Provider 名称，不返回模型、Key、额度或正文。

## 4. 首批任务

只允许原设计中的四类：

- `capture_triage`
- `daily_review`
- `area_coach`
- `plan_next_step`

每类任务都有独立提示规则。共同规则是：不补写用户没有提供的事实；事实、感受、外部原文和 AI 推断必须分开；任何写入动作只能作为 `proposedActions` 返回。

## 5. Provider 映射

### OpenAI

- 使用 Responses API。
- `model` 由服务端环境配置，不写死在 PWA。
- 使用结构化输出，并在 Gateway 再次校验。
- 设置 `store: false`。
- 后续流式版本使用 SSE；先以非流式契约测试正确性和费用边界。

参考：[OpenAI Responses 流式输出](https://developers.openai.com/api/docs/guides/streaming-responses)、[OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。

### DeepSeek

- 使用 Chat Completions API。
- 使用 JSON Output，但仍由 Gateway 再校验。
- `model` 和 base URL 均由服务端配置。

参考：[DeepSeek Chat Completion API](https://api-docs.deepseek.com/api/create-chat-completion)、[DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)。

## 6. 最小安全模型

静态网页的公开 URL 意味着：仅限制 Origin 不能阻止别人直接调用接口。因此 v0.2B 增加一个与供应商 Key 完全不同的 `LIFEOS_ACCESS_TOKEN`：

- 它只用于证明“这是你的工作台请求”。
- 泄露后可以单独撤销，不需要更换模型供应商 Key。
- 第一版只保存在浏览器会话内存或 `sessionStorage`，不进入长期状态和导出文件。
- 真正跨设备登录放到 v0.3 再决定。

这不是完整账号系统，但能避免把一个付费 AI 代理公开给互联网。

## 7. 费用保护

- 前端最多发送 2,000 字；Gateway 最大接受 4,000 字和 64 KiB 请求体。
- 最多 20 个记录 ID、20 条事实、20 条用户表达。
- 服务端限制最大输出 token。
- 不自动重试计费请求。
- 可选接入平台 Rate Limiter；超限返回 `429`。
- 上游 usage 和 request ID 进入响应审计，正文不进入审计。

## 8. 分阶段验收

### B0：本地安全骨架

- 四类请求可校验。
- OpenAI 与 DeepSeek 适配器使用注入的假网络响应完成契约测试。
- 缺少 Key、模型、访问令牌或 Origin 不匹配时明确拒绝。
- 前端继续默认 Mock，离线功能不受影响。
- 源码扫描无真实密钥。

### B1：云端空网关

- 用户选择托管平台。
- 部署时不配置模型 Key，只验证 `/health`。
- 分别用手机流量、家庭 Wi-Fi 和工作网络测试可达性。

### B2：单 Provider 小流量

- 用户自行在平台 Secret 中配置一个供应商 Key。
- 先开启一个任务和很小输出上限。
- 人工检查 20 个样例，再决定是否开放其余任务和流式输出。

## 9. 需要用户确认的两个选择

在 B0 完成后，B1 前只需要确认：

1. 是否先试 Cloudflare Workers，还是指定其他托管平台。
2. 首个 Provider 选择 OpenAI 还是 DeepSeek。

不需要把任何 Key 发给 Codex。Key 应由用户亲自在托管平台的 Secret 页面或受保护的 CLI 提示中输入。
