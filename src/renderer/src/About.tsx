import React from 'react'
import pkg from '../../../package.json'

export function About({ close }: { close(): void }) {
  return <div className="overlay" onClick={close}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><div className="eyebrow">ABOUT</div><h2>关于鸽鸽翻译</h2></div><button onClick={close} aria-label="关闭">✕</button></div><p>让专业内容跨越语言。关注原文的事实、语气与语境。</p><div className="notice"><strong>版本 {pkg.version}</strong><p>版本标签对应 GitHub 的发布记录，例如 v{pkg.version}。正式版与测试版以发布页标记为准。</p></div><h3>领域标签是什么？</h3><p>通用、体外诊断、计算机、互联网标签用于选择相关术语和上下文提示，不能保证模型一定采用或正确理解术语。</p><h3>翻译与数据</h3><p>每次翻译发起一次生成请求；原文和命中术语会发送至所选服务商，Cherry 模式会先经过本机网关。译文未经过自动审校。</p><p className="fine">项目地址：github.com/GeziP/gege-translator</p></aside></div>
}
