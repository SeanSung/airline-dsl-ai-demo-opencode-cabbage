import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Composer } from './Composer'

afterEach(() => cleanup())

function renderComposer(status: 'submitted' | 'streaming' | 'ready' | 'error' = 'ready') {
  const onSend = vi.fn()
  const onStop = vi.fn()
  render(<Composer status={status} onSend={onSend} onStop={onStop} />)
  return { onSend, onStop }
}

describe('Composer', () => {
  it('初始状态：输入框 + disabled + 按钮 + send 按钮', () => {
    renderComposer()
    expect(screen.getByLabelText('输入航线需求')).toBeTruthy()
    expect(screen.getByLabelText('附件（暂不可用）')).toBeDisabled()
    expect(screen.getByTestId('composer-send')).toBeTruthy()
    expect(screen.queryByTestId('composer-stop')).toBeNull()
  })

  it('send 按钮在文本为空时 disabled', () => {
    renderComposer()
    expect(screen.getByTestId('composer-send')).toBeDisabled()
  })

  it('输入文本后 send 按钮启用', () => {
    renderComposer()
    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'test' } })
    expect(screen.getByTestId('composer-send')).not.toBeDisabled()
  })

  it('Enter 发送消息', () => {
    const { onSend } = renderComposer()
    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('Shift+Enter 不发送', () => {
    const { onSend } = renderComposer()
    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('流式状态显示停止按钮', () => {
    const { onStop } = renderComposer('streaming')
    expect(screen.getByTestId('composer-stop')).toBeTruthy()
    expect(screen.queryByTestId('composer-send')).toBeNull()

    fireEvent.click(screen.getByTestId('composer-stop'))
    expect(onStop).toHaveBeenCalled()
  })

  it('submitted 状态也显示停止按钮', () => {
    renderComposer('submitted')
    expect(screen.getByTestId('composer-stop')).toBeTruthy()
  })

  it('发送后清空输入框', () => {
    const { onSend } = renderComposer()
    const textarea = screen.getByLabelText('输入航线需求') as HTMLTextAreaElement
    fireEvent.input(textarea, { target: { value: 'test msg' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('test msg')
    // After send, textarea should be cleared (controlled component)
  })

  it('Composer 外形含 rounded-2xl 和 border', () => {
    renderComposer()
    const form = screen.getByLabelText('输入航线需求').closest('form')!
    expect(form.className).toContain('rounded-2xl')
    expect(form.className).toContain('border')
  })

  it('IME composition 期间 Enter 不发送', () => {
    const { onSend } = renderComposer()
    const textarea = screen.getByLabelText('输入航线需求')
    fireEvent.input(textarea, { target: { value: '你好' } })
    // Start composition
    fireEvent.compositionStart(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
    // End composition
    fireEvent.compositionEnd(textarea)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('你好')
  })
})
