type Provider = 'glm' | 'deepseek' | 'cherry'
type Profile = { model: string; contextTokens: string; maxOutputTokens: string; gatewayPort?: string }
type Profiles = Record<Provider, Profile>
const empty = (): Profile => ({ model: '', contextTokens: '', maxOutputTokens: '' })
export function readProfiles(value: string | null): Profiles {
  const result: Profiles = { glm: empty(), deepseek: empty(), cherry: { ...empty(), gatewayPort: '23333' } }
  try {
    const parsed = JSON.parse(value || '{}') as Record<string, Partial<Profile>>
    for (const provider of ['glm', 'deepseek', 'cherry'] as const) {
      for (const key of ['model', 'contextTokens', 'maxOutputTokens', 'gatewayPort'] as const) {
        if (typeof parsed?.[provider]?.[key] === 'string') result[provider][key] = parsed[provider][key]!
      }
    }
  } catch { /* Ignore corrupted optional preferences. */ }
  return result
}
export function saveProfile(profiles: Profiles, provider: Provider, profile: Profile): Profiles {
  return { ...profiles, [provider]: profile }
}
