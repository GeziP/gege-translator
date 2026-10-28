import { describe, expect, it } from 'vitest'
import { readProfiles, saveProfile } from '../src/renderer/src/profiles'

describe('model profiles', () => {
  it('preserves a separate model and limits for each provider', () => {
    let profiles = readProfiles(null)
    profiles = saveProfile(profiles, 'glm', { model: 'glm-test', contextTokens: '32000', maxOutputTokens: '8192' })
    profiles = saveProfile(profiles, 'deepseek', { model: 'deepseek-test', contextTokens: '64000', maxOutputTokens: '16000' })
    expect(profiles.glm.model).toBe('glm-test')
    expect(profiles.glm.contextTokens).toBe('32000')
    expect(profiles.deepseek.model).toBe('deepseek-test')
  })
  it('ignores invalid saved settings', () => {
    expect(readProfiles('broken').glm.model).toBe('')
    expect(readProfiles('{"glm":{"model":4}}').glm.model).toBe('')
  })
  it('keeps Cherry gateway settings separate from cloud profiles', () => {
    const profiles = saveProfile(readProfiles(null), 'cherry', { model: 'zhipu:glm-test', contextTokens: '32000', maxOutputTokens: '8192', gatewayPort: '23333' })
    expect(readProfiles(JSON.stringify(profiles)).cherry.gatewayPort).toBe('23333')
    expect(profiles.glm.model).toBe('')
  })
})
