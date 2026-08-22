import { describe, expect, it, vi } from 'vitest'
import { fetchMapToken } from './map-token'

describe('fetchMapToken', () => {
  it('从 /api/map-token 获取 token', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: 'abc123' }), { status: 200 })))
    await expect(fetchMapToken(fetchFn as typeof fetch)).resolves.toBe('abc123')
    expect(fetchFn).toHaveBeenCalledWith('/api/map-token')
  })

  it('非 2xx 抛错', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response('nope', { status: 500 })))
    await expect(fetchMapToken(fetchFn as typeof fetch)).rejects.toThrow()
  })
})
