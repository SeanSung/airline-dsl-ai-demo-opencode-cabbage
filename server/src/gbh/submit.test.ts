import { describe, expect, test } from 'bun:test'
import type { AirlineContent } from '@airline-dsl/shared'
import { submitRoute } from './index'

const content: AirlineContent = {
  name: '环绕沧海',
  aircraft_model: 'M350',
  takeoff: { lat: 22.531635, lng: 113.935066, altitude: 100 },
  waypoints: [
    {
      lat: 22.531635,
      lng: 113.935066,
      altitude: 120,
      speed: 15,
      heading_mode: 'followWayline',
      heading_angle: 0,
      turn_mode: 'clockwise',
      actions: [],
    },
  ],
  global_height: 120,
  global_speed: 15,
  finish_action: 'goHome',
  rth_altitude: 100,
  takeoff_security_height: 20,
  exit_on_rc_lost: 'goContinue',
  altitude_mode: 'relativeToStartPoint',
}

describe('gbh.submitRoute', () => {
  test('201 响应返回 {status:"ok", routeId}，且向 {baseUrl}/api/open/routes 发送 POST', async () => {
    let calledUrl = ''
    let calledInit: RequestInit | undefined
    const stubFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calledUrl = String(url)
      calledInit = init
      return new Response(JSON.stringify({ routeId: 'r_20260821' }), { status: 201 })
    }

    const result = await submitRoute(content, { baseUrl: 'http://gbh.test', fetch: stubFetch })

    expect(calledUrl).toBe('http://gbh.test/api/open/routes')
    expect(calledInit?.method).toBe('POST')
    expect(calledInit?.headers).toEqual({ 'content-type': 'application/json' })
    expect(JSON.parse(String(calledInit?.body))).toEqual(content)
    expect(result).toEqual({ status: 'ok', routeId: 'r_20260821' })
  })

  test('400 响应返回 {status:"invalid", errors}（平台校验错误原样透传）', async () => {
    const platformErrors = [{ path: 'waypoints[0].altitude', message: '超出最大高度限制' }]
    const stubFetch = async () =>
      new Response(JSON.stringify({ errors: platformErrors }), { status: 400 })

    const result = await submitRoute(content, { baseUrl: 'http://gbh.test', fetch: stubFetch })

    expect(result).toEqual({ status: 'invalid', errors: platformErrors })
  })

  test('5xx 响应返回 {status:"error", message}（不 throw）', async () => {
    const stubFetch = async () =>
      new Response(JSON.stringify({ message: '平台内部错误' }), { status: 500 })

    const result = await submitRoute(content, { baseUrl: 'http://gbh.test', fetch: stubFetch })

    expect(result).toEqual({ status: 'error', message: '平台内部错误' })
  })

  test('fetch 网络失败返回 {status:"error", message}（不 throw）', async () => {
    const stubFetch = async () => {
      throw new TypeError('fetch failed')
    }

    const result = await submitRoute(content, { baseUrl: 'http://gbh.test', fetch: stubFetch })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.message).toBe('fetch failed')
    }
  })

  test('超时（AbortSignal.timeout）返回 {status:"error", message}（不 throw）', async () => {
    const stubFetch = async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation timed out', 'TimeoutError'))
        })
      })

    const result = await submitRoute(content, {
      baseUrl: 'http://gbh.test',
      fetch: stubFetch,
      timeoutMs: 20,
    })

    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.message).toBe('The operation timed out')
    }
  })
})
