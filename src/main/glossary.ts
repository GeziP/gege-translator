import Papa from 'papaparse'
import type { Term } from './core'

const fields = ['source', 'target', 'meaning', 'domain', 'sourceLanguage', 'targetLanguage'] as const
export function validateTerm(value: unknown): value is Term {
  if (!value || typeof value !== 'object') return false
  const t = value as Term
  return typeof t.source === 'string' && !!t.source.trim() && t.source.length <= 200 && typeof t.target === 'string' && !!t.target.trim() && t.target.length <= 200 && typeof t.meaning === 'string' && t.meaning.length <= 500 && ['ivd', 'computing', 'internet'].includes(t.domain) && ['en', 'zh-CN'].includes(t.sourceLanguage) && ['en', 'zh-CN'].includes(t.targetLanguage) && t.sourceLanguage !== t.targetLanguage
}
export function termKey(t: Term): string { return [t.domain, t.sourceLanguage, t.targetLanguage, t.source.trim().toLowerCase(), t.meaning.trim()].join('\0') }
export function serializeGlossary(terms: Term[]): string { return Papa.unparse({ fields: [...fields], data: terms.map(t => fields.map(f => t[f])) }) }
export function parseGlossary(csv: string): Term[] {
  if (csv.length > 2_000_000) throw new Error('CSV 文件超过 2 MB')
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  if (result.errors.length || fields.some(f => !result.meta.fields?.includes(f))) throw new Error('CSV 格式或表头不正确')
  const entries: Term[] = [], seen = new Set<string>()
  for (const row of result.data) {
    const entry = Object.fromEntries(fields.map(f => [f, row[f] ?? '']))
    if (!validateTerm(entry)) throw new Error('词条缺少内容或语言、领域无效')
    const key = termKey(entry)
    if (seen.has(key)) throw new Error('文件中有重复词条')
    seen.add(key); entries.push(entry)
  }
  return entries
}
