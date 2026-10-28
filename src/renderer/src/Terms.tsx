import React, { useEffect, useState } from 'react'
import type { Domain, Language, Term } from '../../main/core'

export function Terms({ close }: { close(): void }) {
  const [terms, setTerms] = useState<Term[]>([]), [source, setSource] = useState(''), [target, setTarget] = useState(''), [meaning, setMeaning] = useState('')
  const [domain, setDomain] = useState<Domain>('ivd'), [language, setLanguage] = useState<Language>('en'), [message, setMessage] = useState('')
  const refresh = () => window.desktop.listTerms().then(setTerms).catch(() => setMessage('词库读取失败，未覆盖原数据。'))
  useEffect(() => { refresh() }, [])
  const add = async () => {
    if (!source.trim() || !target.trim()) { setMessage('请填写原词和译法。'); return }
    try { await window.desktop.saveTerm({ source, target, meaning, domain, sourceLanguage: language, targetLanguage: language === 'en' ? 'zh-CN' : 'en' }); setSource(''); setTarget(''); setMeaning(''); setMessage('已保存，下次翻译时生效。'); await refresh() } catch { setMessage('保存失败，原词库未更改。') }
  }
  return <div className="overlay" onClick={close}><aside className="drawer" onClick={e => e.stopPropagation()}><div className="drawer-head"><div><div className="eyebrow">PERSONAL GLOSSARY</div><h2>个人术语</h2></div><button onClick={close} aria-label="关闭">✕</button></div><p>填写领域和具体语境，词条用于下一次翻译。内置词条仍处于审核前的示例阶段。</p><label>领域<select value={domain} onChange={e => setDomain(e.target.value as Domain)}><option value="ivd">体外诊断 · IVD</option><option value="computing">计算机</option><option value="internet">互联网</option></select></label><label>翻译方向<select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">英文 → 中文</option><option value="zh-CN">中文 → 英文</option></select></label><label>原词<input value={source} onChange={e => setSource(e.target.value)} maxLength={200}/></label><label>译法<input value={target} onChange={e => setTarget(e.target.value)} maxLength={200}/></label><label>词义或使用语境<input value={meaning} onChange={e => setMeaning(e.target.value)} maxLength={500}/></label><button className="translate full" onClick={add}>添加术语</button><p role="status">{message}</p><div className="term-list">{terms.map((term, index) => <div className="term-row" key={`${term.source}-${index}`}><div><strong>{term.source} → {term.target}</strong><small>{term.domain} · {term.sourceLanguage === 'en' ? '英译中' : '中译英'} {term.meaning && `· ${term.meaning}`}</small></div><button onClick={async () => { try { await window.desktop.deleteTerm(index); await refresh() } catch { setMessage('删除失败，原词库未更改。') } }} aria-label={`删除 ${term.source}`}>删除</button></div>)}</div></aside></div>
}
