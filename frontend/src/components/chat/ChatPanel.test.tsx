import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { AirlineChatProvider } from '../../state/useAirlineChat'
import { ChatPanel } from './ChatPanel'

afterEach(() => cleanup())

function sseBody(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = events.map((e) => encoder.encode(`data: ${e}\n\n`))
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++])
      else controller.close()
    },
  })
}

function stubFetch(events: string[]) {
  const fn = vi.fn((url: string) => {
    if (url === '/api/conversations') {
      return Promise.resolve(
        new Response(JSON.stringify({ conversationId: 'conv-test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    if (url === '/api/conversations/conv-test/messages') {
      return Promise.resolve(
        new Response(sseBody(events), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function renderPanel(events: string[] = []) {
  stubFetch(events)
  return render(
    <AirlineChatProvider>
      <ChatPanel />
    </AirlineChatProvider>,
  )
}

describe('ChatPanel', () => {
  it('空态：greeting + 3 个 suggestion', () => {
    renderPanel()
    expect(screen.getByTestId('composer-greeting')).toBeTruthy()
    expect(screen.getAllByTestId('suggestion')).toHaveLength(3)
  })

  it('点击 suggestion 发送消息', async () => {
    const textDelta = JSON.stringify({ type: 'text_delta', text: 'hi' })
    const done = JSON.stringify({ type: 'done' })
    renderPanel([textDelta, done])

    fireEvent.click(screen.getAllByTestId('suggestion')[0])

    // Should show user bubble
    await waitFor(() => {
      expect(screen.getByTestId('bubble-user')).toBeTruthy()
    })
  })

  it('用户消息显示 bubble-user', async () => {
    const textDelta = JSON.stringify({ type: 'text_delta', text: 'reply' })
    const done = JSON.stringify({ type: 'done' })
    renderPanel([textDelta, done])

    // Type and send
    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'test query' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('bubble-user')).toBeTruthy()
    })
  })

  it('流式中末尾气泡挂 typing 指示器', async () => {
    // Use a controllable stream
    const { promise, resolve } = Promise.withResolvers<void>()
    let controller: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
        // Send text delta but don't close
        c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'text_delta', text: 'hi' })}\n\n`))
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/conversations') {
          return Promise.resolve(
            new Response(JSON.stringify({ conversationId: 'conv-typing' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        }
        if (url === '/api/conversations/conv-typing/messages') {
          return Promise.resolve(
            new Response(stream, {
              status: 200,
              headers: { 'Content-Type': 'text/event-stream' },
            }),
          )
        }
        return Promise.resolve(new Response('not found', { status: 404 }))
      }),
    )

    render(
      <AirlineChatProvider>
        <ChatPanel />
      </AirlineChatProvider>,
    )

    // Send a message
    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    // Wait for assistant bubble with typing indicator
    await waitFor(() => {
      expect(screen.getByTestId('typing')).toBeTruthy()
    })

    // Cleanup
    controller!.close()
    resolve()
  })

  it('errorBar 显示错误', async () => {
    const errorEvent = JSON.stringify({ type: 'error', message: 'Something failed' })
    const done = JSON.stringify({ type: 'done' })
    renderPanel([errorEvent, done])

    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'trigger error' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('error-bar')).toBeTruthy()
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  })

  it('errorBar 文案不含 JSON 花括号', async () => {
    const errorEvent = JSON.stringify({ type: 'error', message: '参数错误' })
    const done = JSON.stringify({ type: 'done' })
    renderPanel([errorEvent, done])

    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'trigger' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      const bar = screen.getByTestId('error-bar')
      expect(bar.textContent).not.toContain('{')
      expect(bar.textContent).not.toContain('}')
    })
  })

  it('Composer 区域存在', () => {
    renderPanel()
    expect(screen.getByLabelText('输入航线需求')).toBeTruthy()
    expect(screen.getByLabelText('附件（暂不可用）')).toBeDisabled()
  })

  it('composer 位于可滚动消息列表之外，长对话时始终贴底', () => {
    renderPanel()
    const messageList = screen.getByTestId('message-list')
    const composer = screen.getByLabelText('输入航线需求').closest('form')!
    // composer 不能是 message-list 滚动容器的后代，否则长消息时会随内容滚走
    expect(messageList.contains(composer)).toBe(false)
    // composer 与 message-list 同属 ChatPanel 的 flex 列，作为底部固定兄弟节点
    expect(composer.className).toContain('mb-3')
  })
})
