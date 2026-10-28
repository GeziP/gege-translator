export type Provider = 'glm' | 'deepseek' | 'cherry'
export type Profile = { model: string; contextTokens: string; maxOutputTokens: string; gatewayPort?: string }
export type SavedModel = { provider: Provider; profile: Profile }
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
export function readModelList(value: string | null): SavedModel[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is SavedModel => x && ['glm', 'deepseek', 'cherry'].includes(x.provider) && x.profile && typeof x.profile.model === 'string' && typeof x.profile.contextTokens === 'string' && typeof x.profile.maxOutputTokens === 'string' && (x.profile.gatewayPort === undefined || typeof x.profile.gatewayPort === 'string')).slice(0, 100)
  } catch { return [] }
}
export function saveModel(list: SavedModel[], provider: Provider, profile: Profile): SavedModel[] {
  return [...list.filter(x => x.provider !== provider || x.profile.model !== profile.model), { provider, profile }]
}
export function deleteModel(list: SavedModel[], provider: Provider, model: string): SavedModel[] {
  return list.filter(x => x.provider !== provider || x.profile.model !== model)
}
