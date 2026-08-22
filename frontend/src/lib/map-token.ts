export interface MapTokenResponse {
  token: string
}

export async function fetchMapToken(fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn('/api/map-token')
  if (!res.ok) {
    throw new Error(`获取天地图 token 失败：HTTP ${res.status}`)
  }
  const data = (await res.json()) as MapTokenResponse
  return data.token
}
