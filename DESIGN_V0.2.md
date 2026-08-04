# LifeOS 个人 AI 工作台 · 产品与技术设计 v0.2

状态：可执行草案  
日期：2026-08-05  
适用范围：`workbench` 手机优先 PWA  

## 1. 一句话定义

LifeOS 是一个每天愿意打开、可以在几十秒内接住生活信息的行动前台。它帮助用户看见今天、推进六个生活领域、形成待确认的 AI 建议，并把重要内容导出为可追溯的 Markdown；它不是长期记忆的唯一载体，也不替代 Obsidian Vault。

## 2. v0.2 要解决的问题

v0.1 已经验证了视觉形式、手机 PWA、快速捕获、本地保存和基础回顾，但仍存在四个核心缺口：

1. 六大领域只能填写“当前重点、最小下一步、说明”，没有可进入的领域空间。
2. 数据模型只有一份当前状态，无法自然承载多日记录、项目、习惯和历史。
3. AI 区域是预设回复，没有稳定的任务类型、上下文边界和可替换 Provider 接口。
4. PWA 与 Obsidian 之间只有手动下载 Daily 草稿，尚未形成清晰、可逆的归档流程。

v0.2 的目标不是做一个万能系统，而是让工作台连续使用七天仍然清楚、可靠、低负担。

## 3. 产品原则

### 3.1 记录优先于规划

工作台首先要接住已经发生的事和正在惦记的事。没有证据时不生成“你应该怎样”的结论，也不要求每个区域都被填满。

### 3.2 一次只推进一个下一步

每个领域首页最多突出一个“最小下一步”。项目、习惯、资料和历史可以存在，但不能同时争夺首页注意力。

### 3.3 AI 只能提议，不能悄悄改写

AI 输出分成三类：

- `answer`：对问题的直接回答。
- `suggestions`：可忽略的建议。
- `proposed_actions`：需要用户确认后才能写入的候选操作。

AI 推断不能直接变成用户事实；任何长期偏好、价值判断或画像结论必须保留来源并等待确认。

### 3.4 本地优先，Markdown 最终可读

浏览器存储负责快速交互，JSON 负责完整备份和迁移，Markdown 负责长期可读归档。Vault 继续是已确认个人知识的权威版本。

### 3.5 Provider 可替换

产品只依赖统一的 `AIProvider` 能力，不让页面直接依赖某一家模型的请求格式。GPT、DeepSeek 或未来的本地模型都通过适配层接入。

## 4. 核心使用节奏

### 4.1 随时捕获：10 秒

1. 输入一句话。
2. 立即保存到本机 Inbox。
3. 可选：选择领域、截止日期或“稍后整理”。
4. AI 可提出分类建议，但默认不自动移动。

### 4.2 早晨：2 分钟

1. 看今天的固定安排与未完成事项。
2. 选择今天最重要的一件事。
3. 从六个领域中最多选择一个辅助推进项。

### 4.3 晚间：3 分钟

1. 记录一件确认发生的事实。
2. 记录体验分数和一句感受。
3. 给明天留一个最小下一步。
4. 下载或导出待确认的 Daily Markdown。

### 4.4 每周：10 分钟

1. 看各领域的活跃项目、停滞项和最近记录。
2. 关闭不再需要的项目。
3. 选择下周最多三个重点。
4. AI 只展示带来源日期的候选观察。

## 5. 信息架构

底部导航保留五项：

- 今天
- 领域
- 回顾
- 数据
- AI

点击领域卡片后进入领域详情，而不是停留在三个输入框。所有领域详情使用同一套骨架：

1. `Overview`：当前重点、一个下一步、领域状态。
2. `Active`：进行中的项目、计划或清单。
3. `Quick log`：该领域最常用的快速记录。
4. `Recent`：最近七条确认记录。
5. `AI coach`：基于用户主动选择内容的领域问答。

## 6. 六大领域设计

### 6.1 身体与健身

核心对象：训练计划、训练记录、身体指标、恢复记录。

快速操作：

- 记录一次训练：类型、时长、主观强度、备注。
- 记录身体状态：体重可选、睡眠、精力、疼痛或恢复。
- 设置下一次训练。

首页重点：本周训练次数、最近一次训练、下一次训练。

明确边界：AI 只能提供一般性计划建议；不把身体数据解释为诊断，不替代医生。

### 6.2 每日工作

核心对象：工作项目、任务、等待事项、决定。

快速操作：

- 记录今天最重要的一件事。
- 新增任务或等待事项。
- 记录决定及原因。
- 标记下一步和截止日期。

首页重点：今日 Top 1、三个下一步、正在等待谁或什么。

### 6.3 英语学习

核心对象：考试目标、学习计划、学习记录、技能短板。

同时支持托业和雅思，但不预设用户已经确定考试：

- 目标：考试类型、目标分、日期均可留空。
- 学习记录：听力、阅读、口语、写作、词汇、综合。
- 每次学习：材料、分钟数、完成内容、一个困难点。
- 下一步：下一次可以直接打开的材料或练习。

首页重点：本周学习分钟、最近技能、下次学习入口。

### 6.4 阅读

核心对象：书籍、阅读进度、摘录、自己的想法。

快速操作：

- 新增在读书籍。
- 记录页码或章节。
- 保存摘录并明确标为“外部原文”。
- 保存自己的想法并明确标为“用户表达”。

首页重点：当前在读、最近进度、下次从哪里开始。

### 6.5 出行与旅行

核心对象：灵感、具体旅程、预订、行程、打包清单。

旅程状态：`idea → planning → booked → travelling → completed → archived`。

快速操作：

- 保存一个想去的地方。
- 新建旅程并记录日期。
- 增加交通、住宿、证件和待办。
- 记录实际旅行经历。

首页重点：最近一段旅程、下一个待确认事项、临近日期。

### 6.6 杂务

核心对象：一次性杂务、周期事项、等待事项。

快速操作：

- 记录容易忘记的事。
- 设置日期或重复节奏。
- 标记等待中、完成或取消。

首页重点：今天到期、七天内到期、等待中。

## 7. 共享数据模型

v0.2 使用可迁移的版本化 JSON。以下是概念模型，不要求一次实现全部字段：

```text
LifeOSStateV2
├─ schemaVersion
├─ profile
│  └─ locale, timezone, optional displayName
├─ settings
│  └─ theme, aiEnabled, provider, model, privacy
├─ inbox[]
├─ days{ YYYY-MM-DD: DailyRecord }
├─ areas{ areaId: AreaState }
├─ items{ itemId: Item }
├─ logs{ logId: LogEntry }
├─ aiThreads{ threadId: AIThreadSummary }
└─ audit[]
```

共享对象：

- `Item`：项目、任务、习惯、旅程、书籍或计划的公共外壳。
- `LogEntry`：已经发生的记录，带日期、领域、来源和文本。
- `SourceRef`：`human`、`external`、`ai`、`human-ai-collaboration`。
- `AIProposal`：AI 建议写入的数据变更，状态为 `pending/accepted/rejected`。

每条记录至少包含：

```json
{
  "id": "稳定 ID",
  "createdAt": "ISO 时间",
  "updatedAt": "ISO 时间",
  "source": "human",
  "areaId": "reading",
  "status": "active"
}
```

### 7.1 迁移原则

- v0.1 数据首次加载时迁移到 v0.2，保留捕获、领域文本和回顾。
- 迁移前保留原始快照，不覆盖旧数据。
- 导入文件先校验 `schemaVersion`，失败时不改当前状态。
- 所有派生统计都可从 `days/items/logs` 重建。

## 8. AI 接入架构

### 8.1 不允许浏览器直接保存供应商密钥

当前站点是公开静态 PWA。OpenAI 官方安全建议明确要求不要把 API Key 部署在浏览器或移动 App 中，也不要提交到代码仓库。因此实际接入 AI 时必须增加一个最小后端代理，把 Key 放在服务端环境变量或密钥管理中。

参考：

- [OpenAI API Key 安全最佳实践](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [OpenAI 模型与 Responses API 指南](https://developers.openai.com/api/docs/guides/latest-model)
- [DeepSeek Chat Completion API](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)

### 8.2 推荐拓扑

```text
手机 PWA
   │  HTTPS，发送用户明确选择的上下文
   ▼
LifeOS AI Gateway
   ├─ OpenAIProvider → Responses API
   └─ DeepSeekProvider → Chat Completions API
```

Gateway 的职责：

- 保存供应商 Key，前端永远看不到。
- 校验输入长度、任务类型和 JSON Schema。
- 限流、超时、取消、重试和费用保护。
- 统一不同供应商的流式输出。
- 删除或最小化日志中的个人正文。
- 返回 `provider/model/usage/requestId`，便于追溯。

### 8.3 Provider 接口

```ts
interface AIProvider {
  id: "openai" | "deepseek" | string;
  generate(request: LifeOSAIRequest): Promise<LifeOSAIResponse>;
  stream?(request: LifeOSAIRequest): AsyncIterable<LifeOSAIEvent>;
  health(): Promise<ProviderHealth>;
}
```

统一请求：

```json
{
  "taskType": "capture_triage | daily_review | area_coach | plan_next_step",
  "userText": "用户本次输入",
  "context": {
    "areaId": "english",
    "selectedRecordIds": [],
    "facts": [],
    "userStatements": []
  },
  "responseMode": "answer | proposal",
  "locale": "zh-CN"
}
```

统一响应：

```json
{
  "answer": "直接回答",
  "suggestions": [],
  "proposedActions": [],
  "provenance": {
    "provider": "openai",
    "model": "由服务端配置",
    "requestId": "..."
  },
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0
  }
}
```

### 8.4 供应商差异处理

- OpenAI 路线优先使用 Responses API；Provider 内部负责把统一请求映射成官方接口。
- DeepSeek 当前提供 OpenAI 风格的 Chat Completions、流式输出、函数调用和 JSON Output，但模型名称和能力会变化，因此模型名放在服务端配置，不写死在页面。
- JSON 结果始终在 Gateway 端再次校验；不能因为供应商宣称 JSON 模式就跳过校验。
- Provider 失败时明确返回错误，不悄悄换模型或重复收费；是否回退到另一供应商由用户设置决定。

### 8.5 首批 AI 任务

只实现四个高价值、低风险任务：

1. `capture_triage`：建议领域、类型和是否需要日期。
2. `daily_review`：把用户输入整理为“事实、感受、决定、明天”，不补写空白。
3. `area_coach`：只使用用户选中的领域记录回答。
4. `plan_next_step`：把模糊目标压缩成一个候选下一步。

不在 v0.2 实现：自动读取整个 Vault、长期画像、医疗判断、自动发送消息、自动下单或其他外部副作用。

## 9. 隐私与审计

- 默认 AI 关闭；开启时明确显示正在使用的 Provider。
- 每次发送前显示上下文摘要，例如“将发送：本次问题 + 3 条英语记录”。
- 不发送未被选中的其他领域、日记或 Vault 内容。
- AI 返回内容标记 `source: ai`，用户接受后标记 `human-ai-collaboration`。
- 审计记录只保留操作类型、时间、记录 ID、Provider 和结果状态；默认不重复保存正文。
- API Key 不进入 localStorage、IndexedDB、导出 JSON、Markdown、Git 或错误日志。

## 10. 技术实现顺序

### v0.2A：今晚可完成

- 建立 `schemaVersion: 2` 和纯函数迁移器。
- 把六大领域改为可进入的详情视图。
- 实现共享的项目/记录/下一步组件。
- 为每个领域提供专属快速记录表单。
- 增加多日 Daily 状态，避免第二天覆盖前一天。
- 升级 JSON 导入导出，加入校验、版本和完整备份。
- 增加 AI Provider 前端接口和本地 Mock，不调用真实 API。
- 增加自动化测试和移动端验收。

### v0.2B：需要用户提供选择后

- 选择 AI Gateway 托管方式。
- 用户自行在服务端配置 OpenAI 或 DeepSeek Key。
- 实现真实流式请求、费用限制和错误处理。
- 只对首批四类 AI 任务进行小规模测试。

### v0.3：真实使用后再决定

- 是否需要账号和跨设备同步。
- 是否把确认记录自动写入本地 Vault。
- 是否需要搜索、索引或更深的长期记忆能力。

## 11. v0.2 验收标准

1. 手机点击任一领域后能看到专属详情并保存一条真实记录。
2. 第二天打开不会覆盖前一天；能导出包含多日数据的 JSON。
3. 快速捕获、领域记录、项目和回顾刷新页面后仍存在。
4. v0.1 数据可以迁移，导入失败不会破坏当前数据。
5. AI Mock 和未来真实 Provider 使用同一请求/响应契约。
6. 页面代码、GitHub 仓库和浏览器存储中不存在 API Key。
7. AI 不能在未确认时修改事实记录。
8. 390px 手机宽度下核心操作无横向滚动，底部导航始终可达。
9. 离线时仍能记录；联网 AI 不可用时本地功能不受影响。
10. 发布包仍然只包含 `workbench`，不包含 Vault、`raw` 或其他个人文件。

## 12. 今晚的持续工作协议

Codex 按以下顺序持续推进，每一阶段都要求可运行、可回退、可验证：

1. 设计冻结：以本文档作为 v0.2 边界。
2. 数据升级：先写模型和迁移，再改界面。
3. 领域体验：先做共享骨架，再逐个加入专属表单。
4. AI 边界：只实现 Provider 合同和 Mock，不接触真实 Key。
5. 验证：语法、迁移、存储、移动端、离线和隐私检查。
6. 发布：只在验证通过后更新 GitHub Pages。

停止条件：遇到必须由用户决定的付费服务、密钥、隐私范围或不可逆外部操作时暂停；普通的本地实现与可逆发布更新继续自主完成。

