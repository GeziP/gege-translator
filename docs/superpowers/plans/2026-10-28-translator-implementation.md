# 专业大模型翻译软件 Implementation Plan

> **执行提示：**按任务顺序在当前会话逐项实施；步骤使用复选框跟踪。用户目前要求完整规划，本文不是开始编写代码的指令。涉及真实服务商调用与人工评审的任务必须记录实际结果，不用模拟结果冒充通过。

**Goal:** 在 Windows 上交付一个中英互译桌面软件，借助领域术语和精心设计的 system prompt，用一次模型生成直接输出忠实自然的译文。

**Architecture:** Electron 主进程拥有凭据、本地词库和模型网络访问；隔离的 React 渲染进程通过窄接口提交翻译任务并展示结果。翻译过程为本地输入准备、术语匹配、一次供应商请求、按技术结束状态展示；不执行译后内容校验或再次生成。

**Tech Stack:** TypeScript、Electron、React、Vite、Vitest；Electron Builder 构建 Windows 安装包；Node 原生 `fetch` 调用 P0 兼容接口。具体依赖版本实施时核实受支持的稳定版本，锁定于 lockfile，不在本文伪造已验证的版本号。

**来源:** [v0.2 产品规范](../specs/2026-10-28-translator-design.md)。

## 全局约束

- Windows 优先；简体中文与英文双向；个人自带标准 API 凭据，纯文本或 Markdown 最多 12,000 Unicode 字符。
- 每次点击翻译最多一次生成请求；无自动重试、自动续写、译后检查、自动润色、审校或跨服务商降级。连接测试是用户单独发起的请求。
- 固定 system prompt 原文以 spec §6.3 为准，输入数据以 JSON 封装；术语只发送命中候选和必要语境。
- 正常结束只说明生成完成，不说明准确；已知截断、拒答、空响应和异常为未完成。
- 模型默认由离线盲评决定；开发时未获得盲评结论前，要求用户选择模型，不宣称最佳模型。
- 初版 P0 为 GLM 标准 API、DeepSeek；Qwen、OpenAI、Claude、Gemini 属于后续接入，未完成联调不得标为已支持。
- Coding Plan 专用额度不用于本自建应用；GLM 标准 API 的独立计费在设置界面说明。
- 发布必须达到 spec 的术语规模、首稿质量和人工评审门槛。允许先发布内部开发构建进行评测，但不能称作正式发布。
- 日常正文仅在内存中保存；默认不记录正文、Key、完整请求或响应。所有模型调用均把原文发给选定服务商。
- 先采用非流式一次返回，响应结束后展示；不做文件上传、历史、网页翻译、OCR、跨块调度、自动同步和插件系统。
- 用户仅要求计划：不创建实现代码、不初始化 Git、不提交、不调用收费接口。

## 设计决定与接口契约

本计划选择非流式处理，满足 spec 对流式的可选要求。避免在未实际评测前猜测各模型最佳温度、上下文大小、价格或推理参数。调用使用 HTTPS 官方固定地址；P0 不提供任意 Base URL，避免凭据误发。模型 ID 由用户填写，能力以已验证配置记录；未知上下文或输出上限的模型不允许静默假定，要求在设置中填写其官方上下文与输出上限并确认。

**术语持久化边界：**内置词条逐词义审核，中文到英文的反向方向须独立审核；150 指已审核词义概念数，不是把两个方向机械翻倍。词条记录每个可用方向，未审核方向不匹配。个人词条为用户确认，不冒充权威来源。

**语言识别：**完全在本地完成，不能发起预请求。去除代码块、URL、标点和数字后统计中日韩统一表意字符与拉丁字母；仅一类存在时选对应源语言；两类均存在、无有效字符或不能确定时要求用户手选，不静默猜测。用户始终可覆盖。目标语言默认取另一方向，同源目标时报错。

**预算与上限：**采用经过测试的保守上界，而不是不可靠地假设“每 4 字符 1 token”。对整个序列化输入按 UTF-8 字节数计算 token 上限，加上固定协议余量；译文预留取原文 UTF-8 字节数与 1024 中较大者。输入估算 + 译文预留须 ≤ 配置的上下文窗口 80%，译文预留须 ≤ 模型输出上限，否则在请求前提示缩短或更换模型。此法可能对中文过于保守，优先保证不截断；正式发布前用真实模型计数能力对中英/Markdown 样本测量其保守性，若不能证明为上界则对该模型禁止自动预算并要求提供其经过验证的 tokenizer。不得用网络计数接口或额外模型调用进行运行时预算。

**接口类型（`src/shared/types.ts` 为唯一来源）：**

```ts
export type Language = 'zh-CN' | 'en';
export type Domain = 'general' | 'ivd' | 'computing' | 'internet';
export type Provider = 'glm' | 'deepseek';
export type TaskStatus = 'completed' | 'incomplete' | 'cancelled';
export type ProviderConfig = {
  provider: Provider; model: string; contextTokens: number; maxOutputTokens: number;
};
export type Term = {
  id: string; domain: Exclude<Domain, 'general'>; sourceLanguage: Language;
  targetLanguage: Language; source: string; target: string; meaning: string;
  aliases: string[]; caseSensitive: boolean; sourceUrl: string;
  review: 'approved' | 'personal'; version: string;
};
export type TranslateRequest = {
  taskId: string; text: string; sourceLanguage: Language; targetLanguage: Language;
  domain: Domain; context: string; config: ProviderConfig;
};
export type Usage = { input?: number; output?: number; reasoning?: number; cached?: number };
export type TranslateResult = {
  taskId: string; status: TaskStatus; text: string; model: string; usage: Usage;
  error?: 'credentials' | 'quota' | 'model' | 'rate_limit' | 'network' | 'timeout' |
    'truncated' | 'refused' | 'empty' | 'protocol' | 'invalid_input';
  retryAfterSeconds?: number;
};
```

配置界面只显示密钥是否已保存，不返回密钥明文；保存/删除凭据是单独操作。个人词库更新与导入先在主进程完整校验再一次性写入，任何失败保留原文件。

**主进程内部函数：**

```ts
matchTerms(text: string, source: Language, target: Language, domain: Domain, terms: Term[]): Term[]
makeMessages(request: TranslateRequest, terms: Term[]): { system: string; user: string }
translate(request: TranslateRequest, signal: AbortSignal): Promise<TranslateResult>
```

**渲染进程唯一可调用的 preload API：**

```ts
interface DesktopAPI {
  translate(request: TranslateRequest): Promise<TranslateResult>;
  cancel(taskId: string): Promise<void>;
  getSettings(): Promise<{ configs: ProviderConfig[]; keySaved: Record<Provider, boolean> }>;
  saveConfig(config: ProviderConfig): Promise<void>;
  saveKey(provider: Provider, key: string, persist: boolean): Promise<{ persisted: boolean }>;
  deleteKey(provider: Provider): Promise<void>;
  testConnection(provider: Provider): Promise<TranslateResult>;
  listTerms(): Promise<Term[]>;
  saveTerm(term: Term): Promise<void>;
  deleteTerm(id: string): Promise<void>;
  previewTermImport(): Promise<{ entries: Term[]; conflicts: string[]; errors: string[] } | null>;
  confirmTermImport(entries: Term[], replaceConflictIds: string[]): Promise<void>;
  exportTerms(): Promise<void>;
}
```

文件选择在主进程弹出原生对话框，渲染进程不能提交任意路径；预览对象与实际导入必须绑定主进程暂存的同一份文件及摘要，禁止前端替换条目绕过预览；上述 `entries` 仅用于确认匹配预览摘要，冲突 ID 必须属于该预览。复制走浏览器剪贴板权限允许的原生功能；不用额外开放任意系统调用。

## 文件结构

| 路径 | 责任 |
| --- | --- |
| `package.json`、`package-lock.json`、`tsconfig.json`、`electron.vite.config.ts`、`electron-builder.yml` | 构建、类型检查、测试和 Windows 打包 |
| `src/shared/types.ts` | 上述领域类型与进程间契约 |
| `src/main/index.ts` | 安全窗口、生命周期、导航与权限限制 |
| `src/main/ipc.ts` | 校验发送者和参数，注册窄接口、管理任务取消 |
| `src/main/translate.ts` | 输入准备、预算、提示词组装与单次生成编排 |
| `src/main/providers.ts` | P0 地址、请求/响应映射、结束状态和错误归一化 |
| `src/main/prompt.ts` | spec §6.3 版本化 system prompt、领域说明和消息构造 |
| `src/main/terms.ts` | 候选匹配、个人词条和 CSV 导入导出 |
| `src/main/storage.ts` | 本地偏好/词库原子写入、系统加密密钥 |
| `src/preload/index.ts` | 只暴露 `DesktopAPI` 中的具体方法 |
| `src/renderer/index.html`、`src/renderer/src/main.tsx`、`App.tsx`、`app.css` | 入口、主界面与布局 |
| `src/renderer/src/Settings.tsx`、`Terms.tsx` | 模型设置、术语管理和 CSV 预览 |
| `data/terms/ivd.json`、`computing.json`、`internet.json`、`README.md` | 审核通过的领域术语及来源说明 |
| `tests/*.test.ts` | 提示词、术语、预算、供应商、存储、状态相关测试 |
| `evaluation/cases.jsonl`、`evaluation/README.md`、`evaluation/runs/` | 评测样本、盲评流程和不含密钥的结果记录 |
| `README.md` | 安装、配置、数据发送、计费、测试和使用说明 |

测试优先覆盖会导致误发密钥、重复计费、错误匹配、任务错乱和输入丢失的行为；不写逐行镜像实现的测试。每个任务运行所列目标检查并保留输出。项目未初始化 Git，执行者不应为满足计划虚构提交；如果用户之后建立仓库，再使用其约定管理变更。

---

## 任务 1：搭建安全桌面外壳与可运行工程

**文件：**`package.json`、`package-lock.json`、`tsconfig.json`、`electron.vite.config.ts`、`src/main/index.ts`、`src/preload/index.ts`、`src/renderer/index.html`、`src/renderer/src/main.tsx`、`src/renderer/src/App.tsx`、`src/renderer/src/app.css`、`src/shared/types.ts`、`tests/security.test.ts`。

**产出接口：**上述 `Language`、`Domain`、`Provider`、`ProviderConfig`、`TranslateRequest`、`TranslateResult` 和 `DesktopAPI`；`npm run dev`、`npm run typecheck`、`npm test`、`npm run build`。

- [ ] 使用 `electron-vite` 官方模板创建 TypeScript + React 基础项目，清理模板演示、远程资源和无关功能；安装 Electron Builder、Vitest，锁定版本。执行 `npm install` 后，记录 Node、Electron 和依赖版本。
- [ ] 创建上文精确类型，在 preload 初始化一个空的 `DesktopAPI` 实现；不暴露 `ipcRenderer` 对象或通用 send/invoke 函数。窗口 `webPreferences` 设 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，仅加载随应用分发的内容；开发模式只允许本机 Vite 地址。
- [ ] 默认拒绝窗口新建、外部导航和权限请求。设置 CSP：仅本地脚本/样式，禁止远程图片与连接；网络请求只在主进程发出。主进程验证 IPC 发送者来自本应用窗口的主 frame。
- [ ] 在 `tests/security.test.ts` 针对窗口配置和 IPC 发送者写断言，验证未知窗口、iframe 或错误来源不能调用接口；执行 `npm test -- tests/security.test.ts`，预期通过。测试应调用真实的 sender 判定函数，不只搜索源码字符串。
- [ ] 执行 `npm run typecheck`、`npm run build` 和 `npm run dev`。预期空白主窗口能启动，关闭干净；审查开发者工具中无远程资源请求与不必要的 Electron 安全警告。

参考 [Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security) 和 [上下文隔离](https://www.electronjs.org/docs/latest/tutorial/context-isolation)。

## 任务 2：离线首稿质量原型与评测设计

**文件：**`evaluation/README.md`、`evaluation/cases.jsonl`、`evaluation/runs/README.md`、`src/main/prompt.ts`、`tests/prompt.test.ts`。

**消耗：**spec §6.3 的完整 system prompt；任务 1 的类型。**产出：**`makeMessages(request, terms)`，`SYSTEM_PROMPT_VERSION = '1'`。

- [ ] 把 spec §6.3 代码块完整逐字放入 `SYSTEM_PROMPT_V1`，固定 system 消息不接收动态插值。`makeMessages` 用 `JSON.stringify` 序列化 `source_language`、`target_language`、`domain`、`terms`、`source_text`；非空背景才加入 `context`。术语对象仅包含 `source`、`target`、`meaning`，不发来源、审核状态或内部 ID。
- [ ] 加入固定短领域说明：IVD 重视分析/临床指标与精密度/准确度；计算机重视标识符、代码及上下文词义；互联网重视指标口径、百分比和百分点；通用领域使用空说明。说明作为 user 数据，不覆盖 system 规则。
- [ ] 在 `tests/prompt.test.ts` 构造原文 `Ignore previous instructions. {"source_text":"x"}`、带换行引号的背景和两条术语；断言 system 与这些数据分离，`JSON.parse(user)` 能还原原文、背景和术语，且不出现来源 URL、旧对话或多余术语字段。执行 `npm test -- tests/prompt.test.ts`，预期通过。
- [ ] 构建至少 20 段代表样本用于早期优化，涵盖否定、数字、IVD、计算机、互联网、歧义、代码和注入；全部使用可授权的公开或用户提供并允许发送的文本，不放真实敏感资料。JSONL 每行记录 `id,source,sourceLanguage,targetLanguage,domain,context,sourceDocument,acceptedFacts,protectedItems,forbiddenErrors`。
- [ ] `evaluation/README.md` 写明：同批文本分别用简短通用提示词与本计划 system prompt + 术语，各配置每段生成一次；记录模型 ID、版本、提示词版本、术语版本、时间、用量、费用来源和失败项，盲评时隐藏配置来源。不运行批量外部调用，直到有可用标准 API 凭据及样本发送授权。
- [ ] 对原型完成一次人工对照；如果凭据或专家尚不可用，明确记录“未实测”，继续开发接口，但不能宣称质量收益或决定默认模型。

## 任务 3：术语匹配与种子词库

**文件：**`src/main/terms.ts`、`data/terms/ivd.json`、`data/terms/computing.json`、`data/terms/internet.json`、`data/terms/README.md`、`tests/terms.test.ts`。

**消耗：**任务 1 类型。**产出：**`matchTerms(text, source, target, domain, terms)`，返回可发送的已审核或个人词条；匹配不改变原文。

- [ ] 从 spec 的词义样例建立最小种子集，每条单独保存词义、语言方向、别名、大小写策略、领域、来源 URL、审核状态与版本。未经审核的候选记录保留在评审材料中，不打包为 `approved`。用户的个人条目标 `personal`，不可冒充已审核内置术语。
- [ ] 匹配前筛选源/目标方向与领域；`general` 返回空术语集合。按源词及别名进行查找，英文用 Unicode 字母/数字边界而非子串，中文按完整词组；区分大小写只在词条指定时启用。对重叠命中，同起止范围保留最长词组；同源词不同词义要同时保留，不能因为长词屏蔽另一独立位置。
- [ ] 对同一领域、方向和相同词义键，个人术语优先于内置术语；不同词义候选并存，交给模型按上下文选。去除重复并按原文首次出现位置、词长降序、ID 排序，保证相同输入结果稳定。
- [ ] `tests/terms.test.ts` 包含：`access token` 和 `token budget` 两种词义；英文 `control` 不匹配 `controller`；LoD 大小写敏感；不同领域不互相注入；个人覆盖同义内置词；中英反向未审核不命中。执行 `npm test -- tests/terms.test.ts`，预期通过。
- [ ] 仅列出已核验来源和使用许可；针对 IVD 优先使用 spec 给出的 FDA、ISO 等公开术语来源。不得通过生成 150 条未经审核词条满足数量门槛。数据责任人和审核记录在任务 9 补全。

## 任务 4：配置、凭据和个人词库存储

**文件：**`src/main/storage.ts`、`src/main/terms.ts`、`src/main/ipc.ts`、`tests/storage.test.ts`、`tests/term-import.test.ts`。

**产出：**`getSettings/saveConfig/saveKey/deleteKey`、个人词库 `listTerms/saveTerm/deleteTerm` 和 CSV 预览、确认、导出接口；所有写入均主进程执行。

- [ ] 偏好和个人术语写到 Electron `app.getPath('userData')`；先在同目录创建随机临时文件，写入并关闭后使用平台支持的原子替换；失败清理临时文件并保留旧内容。读取时区分文件不存在与损坏：不存在用空默认值，损坏提示并保留原文件，不用空内容覆盖。
- [ ] Windows 使用 Electron `safeStorage.isAsyncEncryptionAvailable()`、`encryptStringAsync()`、`decryptStringAsync()` 保存密文；密钥不得放入偏好 JSON、日志或渲染进程持久化。加密不可用或加密失败时只保留本次会话内存并返回 `persisted: false`，UI 显示“仅本次有效”。重启后不应显示已保存；删除时清除密文和内存值。解密失败不得悄悄替换已有密文。
- [ ] 主进程保存每个供应商的密钥，只允许通过固定官方 HTTPS 地址使用；`getSettings` 仅返回 `keySaved` 布尔值。模拟服务商错误包含密钥、正文和响应体时，错误归一化与日志只保存白名单错误码，不回传原始错误。
- [ ] CSV 使用经验证的 UTF-8 CSV 解析器，支持引号、逗号、换行；固定列 `id,domain,sourceLanguage,targetLanguage,source,target,meaning,aliases,caseSensitive`，`aliases` 列使用 JSON 数组字符串。导入时校验所有字段、域、语言方向、重复 ID/词义键和上限，显示错误与冲突后不得写入；确认时必须选择冲突 ID 才能替换。
- [ ] 为满足可逆与表格公式风险，导出写 UTF-8 CSV 原文、不擅自加前缀；保存对话框和术语页提示“CSV 在电子表格中打开时可能执行以 =、+、-、@ 等开头的内容，请以文本方式导入”。导入导出可完整 round-trip，包括危险前缀、引号和换行；用户明确发起导出。
- [ ] 测试加密不可用、加解密失败、文件替换失败和损坏文件，确认旧数据不丢；CSV 测试含危险前缀往返、无效行、重复冲突、预览后内容被替换及确认时未经授权 ID。运行 `npm test -- tests/storage.test.ts tests/term-import.test.ts`，预期通过。

凭据机制参见 [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)；Windows DPAPI 不保证隔离同一用户下的其他应用。

## 任务 5：P0 单次模型调用与错误映射

**文件：**`src/main/providers.ts`、`src/main/translate.ts`、`src/main/ipc.ts`、`tests/providers.test.ts`、`tests/translate.test.ts`。

**消耗：**任务 2 的 `makeMessages`、任务 3 的 `matchTerms`、任务 4 的凭据读取。**产出：**`translate(request, signal)` 和 `DesktopAPI.translate/cancel`。

- [ ] 为 GLM 固定 `https://open.bigmodel.cn/api/paas/v4/chat/completions`，为 DeepSeek 固定 `https://api.deepseek.com/chat/completions`；使用 Node `fetch`、Bearer Key、`Content-Type: application/json`、system 和 user 两条消息、用户选择的模型 ID。参考实施时最新官方文档验证 `max_tokens`、非推理开关和响应字段；不支持的参数省略，不将所有模型硬编码为同一配置。
- [ ] 网络调用前在主进程检查空文本、12,000 Unicode 码点上限（`Array.from(text).length`）、语言方向、模型配置、背景长度、已选凭据、预算和候选术语；长度或预算不足不截断原文，不调用外部接口。使用 §设计决定中的保守预算策略，记录经过验证的模型上限。
- [ ] 请求使用 `AbortController`，任务默认超时 90 秒；同一次点击只允许一次 `fetch`，禁用任何 SDK 重试。对端点、模型和 HTTP 响应做协议解析：成功 `finish_reason=stop` 且非空才返回 `completed`；长度结束、拒答、内容为空、无效结构分别映射 `truncated/refused/empty/protocol`；429、认证、余额/额度、模型、网络与超时映射固定错误码。不同服务商的具体业务码以联调结果维护，未知错误使用 `protocol` 或 `network`，不猜测详细原因。
- [ ] 读取供应商返回的 input/output 和可取得的 reasoning/cached usage；字段不存在保留 `undefined`，不将未知写成零。返回值和错误不包含原始 HTTP 响应或密钥。
- [ ] IPC 按 taskId 管理 `AbortController`，新任务与取消只影响对应 ID；重复 taskId 拒绝。渲染进程切换输入时取消旧任务并忽略迟到响应。后端即使忽略取消，旧响应也不能覆盖新结果；失败后只有用户手动再次点击才触发新请求。
- [ ] 在 `tests/providers.test.ts` 使用本地 mock `fetch` 统计次数并断言：成功、429、5xx、超时、无效 JSON、截断、拒答、空响应均不重试；非 stop 返回 `incomplete`；原文引号和换行保真；请求无工具调用；usage 缺失保留未知。执行 `npm test -- tests/providers.test.ts tests/translate.test.ts`，预期通过，且所有例子的请求计数不超过一次。
- [ ] 联调只用专门授权的标准 API Key 和公开短句，逐个记录 GLM 与 DeepSeek 的请求结果、模型 ID、用量及账单类型；不得发送实际用户秘密或把 Key 写进日志。缺任一凭据时标记该供应商“未真实验证”，不能宣称 P0 完成。

## 任务 6：主界面、交互与任务状态

**文件：**`src/renderer/src/App.tsx`、`src/renderer/src/app.css`、`src/preload/index.ts`、`tests/task-state.test.ts`。

**消耗：**任务 5 的 `DesktopAPI.translate/cancel`。**产出：**可键盘操作的单窗口翻译流程。

- [ ] 构建左右原文、译文文本框；提供源语言自动/中/英、目标语言中/英、领域、供应商/模型、可选背景、翻译、取消和复制按钮。启动时不发送请求；输入超过 12,000 码点显示明确原因并禁用翻译。
- [ ] 实现本地语言识别规则，任何混合或不确定情况要求手选；手选始终优先。切换原文、方向、领域、模型或背景时取消正在运行任务。新任务进行期间保留旧译文；只有当前任务完整结束后替换。失败或取消时保留旧译文，并在状态文案中清楚提示旧结果可能对应旧输入，不能将旧结果标为本次新结果。
- [ ] 非流式模式下状态为“正在翻译 / 已完成 / 未完成 / 已取消”；完成后用户可编辑与复制，编辑不再调用模型。请求异常展示简明错误和可能再次计费的重试提示；不显示“已校验”“准确率”或质量保证。运行中取消时保留原文及先前结果。
- [ ] 样式使用本地资源，不将模型文本当 HTML 执行。textarea 直接显示纯文本及 Markdown 源码，保留格式，不加载图片或链接。为控件、状态与错误加可访问标签和 `aria-live`；键盘 Tab 顺序可达，焦点可见，颜色不是唯一状态信号。
- [ ] 在 `tests/task-state.test.ts` 用延迟 Promise 模拟 A 请求晚于 B 返回、输入修改时取消、失败保留旧结果、用户编辑与复制、emoji 长度及混合语言。运行 `npm test -- tests/task-state.test.ts`；手动在 Windows 检查键盘操作、中文输入和缩放可用。

## 任务 7：设置与术语管理界面

**文件：**`src/renderer/src/Settings.tsx`、`src/renderer/src/Terms.tsx`、`src/renderer/src/App.tsx`、`tests/settings-terms.test.ts`。

**消耗：**任务 4 的配置、密钥与词库接口。**产出：**可配置 P0 服务商和可管理个人术语。

- [ ] 设置提供 GLM、DeepSeek 服务商、模型 ID、经官方资料核实的上下文上限、最大输出上限与 API Key；显示密钥已保存/仅本次有效，允许更新和删除，不显示已保存的密钥。保存按钮不自动测试、不调用模型。
- [ ] 明示 GLM 标准 API 独立计费、Coding Plan 额度不抵扣本应用；提示选定服务商会接收原文、背景和命中术语。主动“连接测试”前显示固定无敏感短句和可能产生费用；点击后发起一次请求，不与翻译任务混用。
- [ ] 术语页面只读显示内置条目；个人条目支持新增、修改、删除，填写方向、领域、源词、译法、词义、别名和大小写策略。保存不对用户正在翻译的任务生效，下一任务使用新快照。
- [ ] 导入由主进程打开文件选择，展示解析错误、重复及冲突，用户确认替换项后一次提交；导出由主进程弹出保存对话框并展示 CSV 风险说明。关闭或取消不修改原数据。
- [ ] 运行 `npm test -- tests/settings-terms.test.ts`，检查无密钥时禁用调用、仅内存凭据提示、连接测试只有一次请求、冲突未确认无写入及删除个人术语不删除内置项；手动验证列表和键盘交互。

## 任务 8：Windows 打包、文档与端到端验证

**文件：**`electron-builder.yml`、`package.json`、`README.md`、`tests/e2e.test.ts`。

- [ ] 配置 Electron Builder Windows x64 安装包和产品名；构建只打包编译产物、内置词库和必要依赖，不打包本地凭据、评测运行结果、用户词库或日志。无用户授权前不上传或发布安装包。
- [ ] `README.md` 给出 Windows 安装与启动、GLM/DeepSeek 标准 API 设置、明确的计费区别、语言及术语操作、一次生成行为、取消和手动重试、数据发往服务商、已知错误和模型输出未校验的事实。不提供包含真实 Key 的示例。
- [ ] 使用本地 mock HTTP 服务或在主进程注入 mock fetch，进行可重复端到端验证：配置凭据→输入文本→命中术语→一次请求→结果展示→复制；覆盖取消、失败、重复点击和旧响应。测试服务禁止通过生产固定端点将密钥重定向到非官方地址。
- [ ] 执行 `npm test`、`npm run typecheck`、`npm run build`、`npm run dist:win`；在干净 Windows 用户环境安装、启动、关闭并重新启动，核实非敏感设置保留、正文不持久化、凭据保护生效。记录安装包路径与命令结果。
- [ ] 核查安装包资源与 `userData` 文件，无原文、测试 Key 和未授权数据；在开发者工具确认译文中的 HTML、远程图片和链接不会执行或自动打开。

## 任务 9：完整术语与首稿质量发布验收

**文件：**`data/terms/ivd.json`、`data/terms/computing.json`、`data/terms/internet.json`、`data/terms/README.md`、`evaluation/cases.jsonl`、`evaluation/README.md`、`evaluation/runs/`、`README.md`。

- [ ] 完成至少 150 个审核通过的词义概念：IVD 70、计算机 50、互联网 30。逐词记录来源、领域、词义、语言方向、审核者与审核日期及许可结论；任何方向未审核则该方向不能进入正式词库。不得复制无权使用的标准正文。
- [ ] 将评测集扩充到至少 120 段：IVD 40、计算机 30、互联网 20、通用 10、混合/歧义/格式/注入 20；中译英和英译中各 60；至少 12 例跨段一致性。80 段开发、40 段独立留出；同源文档不跨集合。
- [ ] 样本中加入 spec §12.4 的所有场景，并记录可接受事实、必保留项、不能出现的错误，不以唯一参考译文做机械字符串评分。记录数据来源及外发许可，不能把未经允许的工作文档上传服务商。
- [ ] 分别对同一候选模型运行通用提示词与本方案；每种配置每个样本一次，不筛选最优。可取得 DeepL 对照时另外记录，其结果不当成真值。记录 provider、实际 model ID、调用参数、系统提示词/词库版本、时间、token、估算费用、失败项和原始首稿；保留集合不能用于调提示词。
- [ ] 至少两位评审独立盲评留出集，IVD 内容由具有 IVD 专业知识的双语评审核对，分歧裁决。记录每段忠实/完整性与通顺/文体 1–5 分、重大错误、严重错误、术语实例数/错误数、保护项数/错误数和是否无需修改即可用。
- [ ] 以人工裁决结果计算：严重意义错误 0 例；保护项 100%；术语实例 ≥98%、关键 IVD 概念 100%；忠实均分 ≥4.5 且无单例 <4；通顺均分 ≥4；可用译文 ≥90%；相对同模型通用提示词重大错误减少且无新增严重错误（基线为零则保持零）。任何门槛未通过不得正式发布；修改模型/提示词/词库后以新留出集重新评测。
- [ ] 实测 GLM、DeepSeek 各一次以上真实调用并核实账单来源；对普通 300–800 字样本分模型记录 P50/P95、输入/输出/推理 token，目标 P50 ≤20 秒、P95 ≤60 秒。无真实凭据、外发授权、足够专家或留出集时，在验收记录标为阻塞，不能用 mock 或助手自评代替。
- [ ] `evaluation/runs/` 的敏感原文与译文不进入发布包或版本控制；只保存脱敏、经授权的评测记录。正式发布文档记录实际支持的模型及验收日期，不把未验证的 P1 标为已支持。

## 任务 10：P1 主流模型后续接入

此任务属于 spec 的后续阶段，不阻塞 P0 开发构建；正式宣传支持某供应商之前必须完成对应验证。

**文件：**`src/shared/types.ts`、`src/main/providers.ts`、`src/main/storage.ts`、`src/renderer/src/Settings.tsx`、`tests/providers.test.ts`、`README.md`。

- [ ] 按需依次接入 Qwen（百炼兼容接口，配置地区和业务空间）、OpenAI Responses、Claude Messages、Gemini 兼容接口；分别实现真实协议，不能把 Claude/OpenAI 原生接口当作 P0 请求格式。服务商的官方固定 HTTPS 地址、模型权限及参数由实现时官方文档确认。
- [ ] 各供应商映射 system 最高优先级指令、纯文本响应、拒答/截断/空响应、取消和可取得 usage；不自动重试、不自动切换服务商、一次点击最多一个生成请求。
- [ ] 为每个供应商补充 mock 协议测试、真实账号短句联调、独立 token 与延迟记录，使用任务 9 的同一首稿质量标准；未具备凭据的供应商显示“未验证”而不是“支持”。

## 执行顺序和依赖

```mermaid
flowchart LR
    A[1 安全外壳] --> B[2 提示词与质量原型]
    A --> C[3 术语匹配]
    A --> D[4 配置与凭据]
    B --> E[5 单次模型调用]
    C --> E
    D --> E
    E --> F[6 翻译界面]
    D --> G[7 设置与词库界面]
    F --> H[8 打包与端到端]
    G --> H
    H --> I[9 术语与盲评发布验收]
    I --> J[10 按需接入更多供应商]
```

任务 2 的早期真实质量评测需要有效标准 API 凭据和可外发素材；任务 9 需要 IVD 双语评审及第二位评审。不能满足时可完成本地开发与模拟测试，但真实联调、首稿质量和正式发布保持未通过状态。

## 计划自查

- 覆盖 spec 1–14：产品流程和约束见任务 1、6、7；单次生成和 prompt 见任务 2、5；词库见任务 3、4、9；Coding Plan 与 P0/P1 见任务 5、7、10；安全、数据与失败见任务 1、4、5、8；离线评测与发布见任务 2、9。
- `Term`、`TranslateRequest`、`TranslateResult`、`DesktopAPI` 均以本文唯一接口契约为准；渲染端无凭据读取接口，运行时无译后质量校验接口。
- 当前没有代码、真实密钥、已审核 150 条词库、120 段评测集或真实盲评结果；所有任务和指标均为待执行计划。
