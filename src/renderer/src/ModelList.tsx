import React from 'react'
import type { SavedModel } from './profiles'

export function ModelList({ models, save, select, remove }: { models: SavedModel[]; save(): void; select(item: SavedModel): void; remove(item: SavedModel): void }) {
  const providerName = { glm: '智谱标准 API', deepseek: 'DeepSeek', cherry: 'Cherry 本地网关' }
  return <section className="model-list"><div className="model-list-head"><strong>已保存的模型</strong><button type="button" onClick={save}>保存当前配置</button></div><p>先填写下方模型设置，再保存。密钥按服务商保存，不包含在列表中。</p>{models.length === 0 ? <p className="model-empty">还没有保存模型配置。</p> : models.map(item => <div className="model-row" key={`${item.provider}:${item.profile.model}`}><button type="button" onClick={() => select(item)}><strong>{item.profile.model}</strong><small>{providerName[item.provider]} · 输出上限 {item.profile.maxOutputTokens || '未设置'}</small></button><button type="button" className="model-remove" onClick={() => remove(item)} aria-label={`删除 ${item.profile.model}`}>删除</button></div>)}</section>
}

export function ModelGuide({ provider, choose }: { provider: SavedModel['provider']; choose(model: string): void }) {
  const choices = provider === 'glm' ? ['glm-5.3-flash', 'glm-5.3'] : provider === 'deepseek' ? ['deepseek-flash', 'deepseek-v4-pro'] : []
  return <section className="model-guide"><strong>如何配置</strong>{provider === 'cherry' ? <p>先在 Cherry Studio 启动 API 网关，保存其网关密钥，再读取模型列表。套餐授权和扣费请向智谱确认。</p> : <><p>在服务商控制台开通标准 API、创建 Key，并确认账号余额和模型权限。选一个模型，或手动填写其他模型 ID。</p><div>{choices.map(id => <button type="button" key={id} onClick={() => choose(id)}>{id}</button>)}</div></>}<p>按模型文档填写上下文上限和单次输出上限；8192 可作为短文本的起始输出额度，截断时需调整。</p></section>
}
