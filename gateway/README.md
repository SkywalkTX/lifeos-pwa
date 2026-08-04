# LifeOS AI Gateway

这是 `DESIGN_V0.2B.md` 的 B0 本地安全骨架。它包含四类任务的请求校验、OpenAI/DeepSeek 适配器、统一响应、Origin 检查、个人访问令牌和可选限流。

当前不会自动部署，也不包含真实密钥。运行仓库测试不需要联网或安装依赖：

```powershell
npm test
```

未来选择 Cloudflare Workers 后，再由用户确认安装 Wrangler、登录 Cloudflare 和创建外部资源。真实供应商 Key 应通过 Cloudflare Dashboard Secret 或交互式 `wrangler secret put` 输入，不写进命令、文件、聊天或 Git。

部署前必须修正 `wrangler.jsonc` 中的 `ALLOWED_ORIGIN`：GitHub Pages 站点的 Origin 是 `https://skywalktx.github.io`，不包含路径 `/lifeos-pwa/`。

需要的 Secret：

- `LIFEOS_ACCESS_TOKEN`
- `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`（只配置选中的一个）

需要的普通环境配置：

- `AI_PROVIDER=openai|deepseek`
- `AI_MODEL=<服务端选择的模型 ID>`
- `AI_MAX_OUTPUT_TOKENS=800`

`.dev.vars.example` 只能作为变量名模板。真实 `.dev.vars` 已被仓库忽略。
