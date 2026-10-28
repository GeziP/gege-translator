import { describe, expect, it } from 'vitest'
import { parseGlossary, serializeGlossary } from '../src/main/glossary'

const entry = { source: '=A1', target: '检测,"样本"', meaning: '第一行\n第二行', domain: 'ivd' as const, sourceLanguage: 'en' as const, targetLanguage: 'zh-CN' as const }
describe('personal glossary CSV', () => {
  it('preserves quoted text, newlines and formula-like terms without changing the data', () => {
    expect(parseGlossary(serializeGlossary([entry]))).toEqual([entry])
  })
  it('rejects incomplete, malformed, duplicate and same-language entries', () => {
    expect(() => parseGlossary('source,target\nx,y')).toThrow()
    expect(() => parseGlossary(serializeGlossary([entry, entry]))).toThrow()
    expect(() => parseGlossary(serializeGlossary([{ ...entry, targetLanguage: 'en' }]))).toThrow()
  })
})
