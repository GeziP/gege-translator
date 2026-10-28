# 译间 · Gege Translator

**让语言，准确抵达。**

译间是一款正在开发的 Windows 中英翻译工具，专注于忠实、自然的专业文本翻译。它使用大模型一次生成译文，通过系统提示词和领域术语帮助模型理解语境。

> 测试版正在开发。模型联调、专业术语和翻译质量仍需进一步验证，不建议用于对准确性要求高的正式文件。

## 设计目标

- **一次生成**：每次翻译至多发起一次模型请求，不自动审校、修订或重试。
- **专业语境**：面向 IVD、计算机、互联网领域，结合上下文选择术语；支持编辑个人术语并导入、导出 CSV。
- **忠于原文**：强调保留否定、条件、数字、单位、语气及 Markdown 结构。
- **自带模型凭据**：设计支持智谱 GLM 标准 API 和 DeepSeek；后续再接入其他模型。
- **专注翻译**：双栏输入输出，支持编辑、复制与取消，不需要聊天工作流。

当前领域术语仅为少量开发用示例，**尚未完成专业审核，也不是正式术语库**。

## GLM Coding Plan 与费用

本项目面向智谱**标准 API**，调用费用由标准 API 账户或资源包承担。根据[智谱官方说明](https://docs.bigmodel.cn/cn/coding-plan/faq)，自建应用不能假定使用 GLM Coding Plan 套餐额度。DeepSeek 等服务同样按各自服务商的规则计费。

## 隐私与使用边界

用户输入的原文、背景和匹配的术语会发送到所选模型服务商。API Key 由桌面主进程处理；系统加密不可用时仅在本次运行中保存。请勿在尚未确认外发权限的情况下输入敏感资料。

译文不会经过自动校验，模型可能误译或遗漏。正式对外、医疗器械、法规及其他重要材料应由具备相应知识的人员复核。

## 开发状态

项目规格和实施计划分别见 [产品 spec](docs/superpowers/specs/2026-10-28-translator-design.md) 与 [实现计划](docs/superpowers/plans/2026-10-28-translator-implementation.md)。

Windows 安装包由 GitHub Actions 构建，并在安装后进行启动检查。正式版本仍需完成专业术语审核、模型真实联调、评测样本与人工盲评。

## 安装与使用

1. 在 [Releases](https://github.com/GeziP/gege-translator/releases) 页面下载 Windows x64 测试版安装程序并安装。测试版未签名，Windows 可能提示未知发布者。
2. 打开“模型设置”，选择 GLM 标准 API 或 DeepSeek，填入服务商提供的模型 ID、API Key、上下文上限和最大输出 token 数。
3. 粘贴文本，选择语言与领域，点击“开始翻译”。混合语言文本需要手动选择源语言。
4. 如有惯用译法，可在“个人术语”中添加、编辑或导入 CSV。导出 CSV 用电子表格打开时应以文本方式导入。

如果模型调用失败，请检查账号余额、模型权限和网络；本软件不会自动重试或切换服务商。

```powershell
npm ci
npx install-electron
npm run typecheck
npm test
npm run build
npm run dev
```

需要 Node.js 24 和 Electron 运行时下载。构建、类型检查和核心测试已运行；Windows 自动安装与启动检查见 GitHub Actions。上限的本地估算尚未经各模型分词器验证；服务商参数及账单尚未经真实联调。

## 设计原型

[查看 Magic Patterns 设计原型](https://www.magicpatterns.com/c/udbb2pt8zdlxzwjrxyf1vg)。该原型用于探索视觉设计，不代表所有画面功能均已实现。
