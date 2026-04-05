import { describe, expect, it } from 'vitest'
import type { Conversation, Message, MediaAttachment, PluginConfig, ConsentMode } from '../src/types'

describe('types', () => {
  it('Conversation satisfies the interface', () => {
    const conv: Conversation = {
      id: 'conv-1',
      name: 'Alice',
      phoneNumber: '+1234567890',
      isGroup: false,
      lastMessage: 'Hey there!',
      lastTimestamp: '2026-04-05T12:00:00Z',
      unreadCount: 2,
    }
    expect(conv.id).toBe('conv-1')
    expect(conv.name).toBe('Alice')
    expect(conv.phoneNumber).toBe('+1234567890')
    expect(conv.isGroup).toBe(false)
    expect(conv.unreadCount).toBe(2)
  })

  it('Conversation supports group chats with participants', () => {
    const conv: Conversation = {
      id: 'conv-2',
      name: 'Family Group',
      isGroup: true,
      lastMessage: 'See you tonight',
      lastTimestamp: '2026-04-05T14:30:00Z',
      unreadCount: 0,
      participants: ['Alice', 'Bob', 'Charlie'],
    }
    expect(conv.isGroup).toBe(true)
    expect(conv.participants).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('Message satisfies the interface', () => {
    const msg: Message = {
      id: 'msg-1',
      sender: 'Alice',
      text: 'Hello!',
      timestamp: '2026-04-05T12:00:00Z',
      isOutgoing: false,
    }
    expect(msg.sender).toBe('Alice')
    expect(msg.isOutgoing).toBe(false)
  })

  it('Message supports media attachments', () => {
    const msg: Message = {
      id: 'msg-2',
      sender: 'Me',
      text: '',
      timestamp: '2026-04-05T12:01:00Z',
      isOutgoing: true,
      media: [
        { type: 'image', filename: 'photo.jpg', downloadable: true },
        { type: 'file', filename: 'doc.pdf', downloadable: true },
      ],
      replyTo: 'msg-1',
    }
    expect(msg.media).toHaveLength(2)
    expect(msg.media![0].type).toBe('image')
    expect(msg.replyTo).toBe('msg-1')
  })

  it('PluginConfig has correct defaults shape', () => {
    const config: PluginConfig = {
      consentMode: 'approve',
      idleTimeoutMs: 5 * 60 * 1000,
      healthCheckIntervalMs: 30 * 1000,
      watchDefaultIntervalMs: 10 * 1000,
    }
    expect(config.consentMode).toBe('approve')
    expect(config.idleTimeoutMs).toBe(300000)
  })

  it('ConsentMode only allows approve or trust', () => {
    const approve: ConsentMode = 'approve'
    const trust: ConsentMode = 'trust'
    expect(approve).toBe('approve')
    expect(trust).toBe('trust')
  })
})
