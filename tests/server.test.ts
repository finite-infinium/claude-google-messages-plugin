import { describe, expect, it } from 'vitest'
import { buildToolDefinitions, handleConsentCheck } from '../src/server'
import type { ConsentMode } from '../src/types'

describe('buildToolDefinitions', () => {
  it('returns all expected tools', () => {
    const tools = buildToolDefinitions()
    const names = tools.map(t => t.name)
    expect(names).toContain('list_conversations')
    expect(names).toContain('read_messages')
    expect(names).toContain('search_messages')
    expect(names).toContain('send_message')
    expect(names).toContain('reply')
    expect(names).toContain('download_media')
    expect(names).toContain('get_status')
    expect(names).toContain('set_consent_mode')
    expect(names).toContain('watch_conversation')
    expect(names).toContain('unwatch_conversation')
  })

  it('each tool has a name, description, and inputSchema', () => {
    const tools = buildToolDefinitions()
    for (const tool of tools) {
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('send_message requires contact and text', () => {
    const tools = buildToolDefinitions()
    const sendMsg = tools.find(t => t.name === 'send_message')!
    expect(sendMsg.inputSchema.required).toContain('contact')
    expect(sendMsg.inputSchema.required).toContain('text')
  })

  it('reply requires text', () => {
    const tools = buildToolDefinitions()
    const reply = tools.find(t => t.name === 'reply')!
    expect(reply.inputSchema.required).toContain('text')
  })
})

describe('handleConsentCheck', () => {
  it('returns draft in approve mode when not confirmed', () => {
    const result = handleConsentCheck('approve', 'Alice', 'Hello!', false)
    expect(result.shouldSend).toBe(false)
    expect(result.draftMessage).toContain('Alice')
    expect(result.draftMessage).toContain('Hello!')
  })

  it('returns send in approve mode when confirmed', () => {
    const result = handleConsentCheck('approve', 'Alice', 'Hello!', true)
    expect(result.shouldSend).toBe(true)
  })

  it('always returns send in trust mode', () => {
    const result = handleConsentCheck('trust', 'Alice', 'Hello!', false)
    expect(result.shouldSend).toBe(true)
  })
})
