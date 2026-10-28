import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { detectLanguage, type Domain, type Language, type Request, type Result, type Term } from '../../main/core'
import { Terms } from './Terms'
import { readProfiles, saveProfile } from './profiles'
import './style.css'

declare global { interface Window { desktop: {
  saveKey(provider: string, key: string, persist: boolean): Promise<{ persisted: boolean }>
  keyStatus(): Promise<Record<string, boolean>>
  gatewayModels(port: number): Promise<{ models?: string[]; error?: string }>
  deleteKey(provider: string): Promise<void>
  listTerms(): Promise<Term[]>
  saveTerm(term: Term, index?: number): Promise<void>
  deleteTerm(index: number): Promise<void>
  previewTerms(): Promise<{ token: string; count: number; conflicts: number; entries: Term[] } | null>
  confirmTerms(token: string, replace: boolean): Promise<void>
  exportTerms(): Promise<void>
  translate(id: string, request: Omit<Request, 'key'>): Promise<Result>
  cancel(id: string): Promise<void>
} } }

function App() {
  const [text, setText] = useState(''), [output, setOutput] = useState('')
  const [source, setSource] = useState<Language | 'auto'>('auto'), [target, setTarget] = useState<Language>('zh-CN')
  const [domain, setDomain] = useState<Domain>('general'), [context, setContext] = useState('')
  const [provider, setProvider] = useState<Request['provider']>(() => { const saved = localStorage.getItem('provider'); return saved === 'deepseek' || saved === 'cherry' ? saved : 'glm' })
  const [profiles, setProfiles] = useState(() => readProfiles(localStorage.getItem('model-profiles')))
  const { model, contextTokens, maxOutputTokens, gatewayPort } = profiles[provider]
  const [status, setStatus] = useState('准备就绪'), [busy, setBusy] = useState(false), [settings, setSettings] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [key, setKey] = useState(''), [persist, setPersist] = useState(true), [saved, setSaved] = useState<Record<string, boolean>>({})
  const [gatewayModelList, setGatewayModelList] = useState<string[]>([]), [gatewayMessage, setGatewayMessage] = useState('')
  const active = useRef<string | null>(null)
  useEffect(() => { window.desktop.keyStatus().then(setSaved) }, [])
  useEffect(() => { localStorage.setItem('provider', provider); localStorage.setItem('model-profiles', JSON.stringify(profiles)) }, [provider, profiles])
  const updateProfile = (field: 'model' | 'contextTokens' | 'maxOutputTokens' | 'gatewayPort', value: string) => setProfiles(previous => saveProfile(previous, provider, { ...previous[provider], [field]: value }))
  const invalidate = () => {
    if (active.current) { window.desktop.cancel(active.current); active.current = null; setBusy(false); setStatus('已取消；现有译文可能属于之前的原文') }
    else if (output) setStatus('内容或设置已更改；现有译文属于之前的任务')
  }
  const run = async () => {
    const detected = source === 'auto' ? detectLanguage(text) : source
    if (!text.trim() || Array.from(text).length > 12000) { setStatus('请输入不超过 12,000 字符的原文'); return }
    if (!detected) { setStatus('无法确定源语言，请手动选择'); return }
    if (detected === target) { setStatus('源语言与目标语言相同，请调整'); return }
    if (!model.trim()) { setStatus('请在设置中填写模型 ID'); setSettings(true); return }
    invalidate()
    const id = crypto.randomUUID(); active.current = id; setBusy(true); setStatus('正在翻译…')
    try {
      const result = await window.desktop.translate(id, { text, source: detected, target, domain, context, provider, model, contextTokens: Number(contextTokens), maxOutputTokens: Number(maxOutputTokens), ...(provider === 'cherry' ? { gatewayPort: Number(gatewayPort) } : {}) })
      if (active.current !== id) return
      if (result.status === 'completed') { setOutput(result.text); setStatus('已完成') }
      else {
        const message = ({ credentials: provider === 'cherry' ? '本地网关验证失败，请检查 Cherry 网关密钥及启动状态' : 'API Key 验证失败，请检查所选服务商的 Key', balance: provider === 'glm' ? '智谱标准 API 余额或资源包不足；Coding Plan 额度不适用于本应用' : 'API 余额不足，请检查服务商账户', plan_key: '此 Key 仅限编程套餐，请使用标准 API Key', quota: '服务商报告额度、套餐或模型权限受限，请检查账户', model: '模型不存在，请检查模型 ID', rate_limit: '服务商报告请求频率或并发超限', busy: '模型当前繁忙，请稍后手动重试', rejected: '服务商拒绝了请求，可能与额度、权限或请求限制有关，请检查账户', truncated: '输出被截断，请缩短原文', budget: '请填写模型上下文及输出上限，或缩短原文', invalid_input: '输入或设置无效，请检查本地端口（1000–65535）', network: provider === 'cherry' ? '无法连接本地网关，请确认 Cherry Studio 和 API 网关正在运行' : '网络连接失败', provider: '模型服务请求失败，请检查模型和账户配置', cancelled: '已取消' } as Record<string, string>)[result.error || ''] || '服务未返回完整译文'
        const detail = [result.httpStatus ? `HTTP ${result.httpStatus}` : '', result.code ? `错误码 ${result.code}` : ''].filter(Boolean).join('，')
        setStatus(`未完成：${message}${detail ? `（${detail}）` : ''}。${output ? '现有译文可能属于之前的原文。' : ''}`)
      }
    } catch { if (active.current === id) setStatus('请求失败，请检查设置与网络。现有译文可能属于之前的原文。') }
    finally { if (active.current === id) { active.current = null; setBusy(false) } }
  }
  const save = async () => {
    if (!key.trim()) { setStatus('请输入 API Key'); return }
    try { const result = await window.desktop.saveKey(provider, key.trim(), persist); setKey(''); setSaved(await window.desktop.keyStatus()); setStatus(result.persisted ? '密钥已保存' : '新密钥仅本次有效，原保存密钥未更改') } catch { setStatus('保存失败，请重试') }
  }
  const loadGatewayModels = async () => {
    setGatewayMessage('正在读取本地网关的模型列表…')
    try {
      const result = await window.desktop.gatewayModels(Number(gatewayPort))
      if (!result.models) { setGatewayMessage(result.error === 'credentials' ? '请先保存 Cherry 网关密钥。' : '读取失败：请检查 Cherry 是否运行、网关密钥和端口。'); return }
      setGatewayModelList(result.models); setGatewayMessage(result.models.length ? '请选择模型。' : '网关未返回模型，请在 Cherry 中启用模型。')
    } catch { setGatewayMessage('读取失败：请检查 Cherry 是否运行、网关密钥和端口。') }
  }
  return <div className="app">
    <header><div className="brand"><span className="brand-icon">译</span><div><strong>译间</strong><small>TRANSLATION STUDIO</small></div></div><div><button className="settings-button" onClick={() => setShowTerms(true)}>个人术语</button>　<button className="settings-button" onClick={() => setSettings(!settings)} aria-expanded={settings}>⚙　模型设置</button></div></header>
    <main><section className="intro"><div><div className="eyebrow">THOUGHTFUL TRANSLATION <span>✳</span></div><h1>让语言，准确抵达。</h1><p>忠于原意，也让表达自然发生。</p></div><div className="intro-mark">文<span> / </span>Aa</div></section>
      <div className="toolbar"><label>领域<select value={domain} onChange={e => { invalidate(); setDomain(e.target.value as Domain) }}><option value="general">通用</option><option value="ivd">体外诊断 · IVD</option><option value="computing">计算机</option><option value="internet">互联网</option></select></label><div className="toolbar-right"><span className="dot"/> {provider === 'glm' ? 'GLM' : provider === 'cherry' ? 'Cherry 本地网关' : 'DeepSeek'} <span className="model-label">{model || '未设置模型'}</span></div></div>
      <section className="workspace"><div className="pane"><div className="pane-head"><label>原文 <select aria-label="源语言" value={source} onChange={e => { invalidate(); setSource(e.target.value as Language | 'auto') }}><option value="auto">自动识别</option><option value="zh-CN">中文</option><option value="en">English</option></select></label><span>01</span></div><textarea value={text} placeholder="在这里输入或粘贴需要翻译的文字…" onChange={e => { invalidate(); setText(e.target.value); const detected = source === 'auto' ? detectLanguage(e.target.value) : null; if (detected) setTarget(detected === 'en' ? 'zh-CN' : 'en') }} /><div className="pane-foot"><span>支持纯文本与 Markdown</span><span>{Array.from(text).length} / 12,000</span></div></div>
      <div className="pane result"><div className="pane-head"><label>译文 <select aria-label="目标语言" value={target} onChange={e => { invalidate(); setTarget(e.target.value as Language) }}><option value="zh-CN">中文</option><option value="en">English</option></select></label><span>02</span></div><textarea value={output} placeholder="译文将在这里呈现。" onChange={e => { setOutput(e.target.value); setStatus('已手动修改') }} /><div className="pane-foot"><span>可以直接编辑译文</span><button className="copy" disabled={!output} onClick={() => navigator.clipboard.writeText(output).then(() => setStatus('译文已复制')).catch(() => setStatus('复制失败'))}>复制译文 ↗</button></div></div></section>
      <div className="actions"><details><summary>添加翻译背景 <span>可选</span></summary><textarea value={context} onChange={e => { invalidate(); setContext(e.target.value) }} placeholder="例如：体外诊断试剂说明书，面向实验室人员" /></details><div><button className="translate" disabled={busy} onClick={run}>开始翻译 <span>→</span></button>{busy && <button className="cancel" onClick={invalidate}>取消</button>}</div></div>
      <div className="status" role="status" aria-live="polite"><span className="dot"/> {status}</div>
      <footer><span>用恰当的词，传递准确的意思。</span><span>译间 · 专注每一次表达</span></footer>
    </main>{showTerms && <Terms close={() => setShowTerms(false)} />}{settings && <div className="overlay" onClick={() => setSettings(false)}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><div className="eyebrow">PREFERENCES</div><h2>模型设置</h2></div><button onClick={() => setSettings(false)} aria-label="关闭">✕</button></div><p>配置你的模型服务，翻译内容将发送至所选服务商。</p><label>模型服务<select value={provider} onChange={e => { invalidate(); setProvider(e.target.value as Request['provider']); setKey('') }}><option value="glm">智谱 GLM 标准 API</option><option value="deepseek">DeepSeek</option><option value="cherry">Cherry Studio 本地网关（实验）</option></select></label>{provider === 'cherry' && <div className="notice"><strong>本地网关接入</strong><p>在 Cherry Studio 设置中启动 API 网关，将网关密钥与模型 ID 填在这里；请勿填入智谱套餐密钥。套餐是否适用于外部网关调用需向智谱确认。</p><label>本地网关端口<input type="number" value={gatewayPort || ''} onChange={e => { invalidate(); updateProfile('gatewayPort', e.target.value) }} /></label></div>}{provider === 'cherry' && <div className="notice"><button type="button" onClick={loadGatewayModels}>读取本地模型列表</button><p role="status">{gatewayMessage}</p>{gatewayModelList.length > 0 && <label>选择网关模型<select value={gatewayModelList.includes(model) ? model : ''} onChange={e => { invalidate(); updateProfile('model', e.target.value) }}><option value="">请选择模型</option>{gatewayModelList.map(id => <option key={id} value={id}>{id}</option>)}</select></label>}</div>}<label>模型 ID<input value={model} onChange={e => { invalidate(); updateProfile('model', e.target.value) }} placeholder={provider === 'cherry' ? '例如：zhipu:glm-5.3-flash，以网关模型列表为准' : '输入服务商提供的模型名称'} /></label><label>模型上下文上限（token）<input type="number" value={contextTokens} onChange={e => { invalidate(); updateProfile('contextTokens', e.target.value) }} placeholder="按服务商文档填写" /></label><label>模型输出上限（token）<input type="number" value={maxOutputTokens} onChange={e => { invalidate(); updateProfile('maxOutputTokens', e.target.value) }} placeholder="按服务商文档填写" /></label><label>{provider === 'cherry' ? 'Cherry 网关密钥' : 'API Key'}<input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={saved[provider] ? '已保存，可输入新密钥替换' : '输入 API Key'} /></label><label className="check"><input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)} />使用系统保护保存密钥</label><button className="translate full" onClick={save}>保存密钥</button>{saved[provider] && <button className="delete" onClick={async () => { await window.desktop.deleteKey(provider); setSaved(await window.desktop.keyStatus()); setStatus('密钥已删除') }}>删除已保存密钥</button>}<div className="notice"><strong>关于 GLM Coding Plan</strong><p>本应用使用智谱标准 API，调用费用单独计费，Coding Plan 套餐额度不抵扣。</p></div><p className="fine">翻译只发起一次模型请求。生成完成表示服务已返回，并不代表译文经过核验。</p></aside></div>}</div>
}
createRoot(document.getElementById('root')!).render(<App />)
