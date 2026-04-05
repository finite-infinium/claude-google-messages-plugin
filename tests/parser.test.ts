import { describe, expect, it } from 'bun:test'
import { parseConversationList, parseMessageThread, parseTimestamp } from '../src/parser'

const CONVERSATION_LIST_HTML = `
<nav>
  <mws-conversation-list-item data-e2e-conversation-id="conv-1">
    <div class="name">Alice</div>
    <div class="snippet">Hey, are you free tonight?</div>
    <div class="timestamp">2:30 PM</div>
    <div class="unread-count">2</div>
  </mws-conversation-list-item>
  <mws-conversation-list-item data-e2e-conversation-id="conv-2">
    <div class="name">Family Group</div>
    <div class="snippet">Bob: See you at dinner</div>
    <div class="timestamp">Yesterday</div>
  </mws-conversation-list-item>
  <mws-conversation-list-item data-e2e-conversation-id="conv-3">
    <div class="name">+1 555-0123</div>
    <div class="snippet">Your verification code is 1234</div>
    <div class="timestamp">Mon</div>
  </mws-conversation-list-item>
</nav>
`

const MESSAGE_THREAD_HTML = `
<mws-messages-list>
  <mws-message-wrapper class="incoming" data-message-id="msg-1">
    <div class="sender-name">Alice</div>
    <div class="text-msg">Hey, are you free tonight?</div>
    <div class="timestamp">2:30 PM</div>
  </mws-message-wrapper>
  <mws-message-wrapper class="outgoing" data-message-id="msg-2">
    <div class="text-msg">Yeah! What's up?</div>
    <div class="timestamp">2:31 PM</div>
  </mws-message-wrapper>
  <mws-message-wrapper class="incoming" data-message-id="msg-3">
    <div class="text-msg">Dinner at 7?</div>
    <div class="timestamp">2:32 PM</div>
    <div class="media-container">
      <img src="blob:..." alt="Photo">
    </div>
  </mws-message-wrapper>
</mws-messages-list>
`

describe('parseConversationList', () => {
  it('extracts conversation data from HTML', () => {
    const conversations = parseConversationList(CONVERSATION_LIST_HTML)
    expect(conversations).toHaveLength(3)
  })

  it('extracts name, snippet, timestamp, and unread count', () => {
    const conversations = parseConversationList(CONVERSATION_LIST_HTML)
    const alice = conversations[0]
    expect(alice.name).toBe('Alice')
    expect(alice.lastMessage).toBe('Hey, are you free tonight?')
    expect(alice.unreadCount).toBe(2)
  })

  it('handles conversations with no unread count', () => {
    const conversations = parseConversationList(CONVERSATION_LIST_HTML)
    const family = conversations[1]
    expect(family.name).toBe('Family Group')
    expect(family.unreadCount).toBe(0)
  })

  it('detects phone numbers as phoneNumber field', () => {
    const conversations = parseConversationList(CONVERSATION_LIST_HTML)
    const unsaved = conversations[2]
    expect(unsaved.name).toBe('+1 555-0123')
    expect(unsaved.phoneNumber).toBe('+1 555-0123')
  })

  it('returns empty array for empty HTML', () => {
    const conversations = parseConversationList('<nav></nav>')
    expect(conversations).toHaveLength(0)
  })
})

describe('parseMessageThread', () => {
  it('extracts messages from HTML', () => {
    const messages = parseMessageThread(MESSAGE_THREAD_HTML)
    expect(messages).toHaveLength(3)
  })

  it('identifies incoming vs outgoing messages', () => {
    const messages = parseMessageThread(MESSAGE_THREAD_HTML)
    expect(messages[0].isOutgoing).toBe(false)
    expect(messages[1].isOutgoing).toBe(true)
  })

  it('extracts sender name for incoming messages', () => {
    const messages = parseMessageThread(MESSAGE_THREAD_HTML)
    expect(messages[0].sender).toBe('Alice')
    expect(messages[1].sender).toBe('Me')
  })

  it('extracts message text and timestamp', () => {
    const messages = parseMessageThread(MESSAGE_THREAD_HTML)
    expect(messages[0].text).toBe('Hey, are you free tonight?')
  })

  it('detects media attachments', () => {
    const messages = parseMessageThread(MESSAGE_THREAD_HTML)
    expect(messages[2].media).toBeDefined()
    expect(messages[2].media!.length).toBeGreaterThan(0)
    expect(messages[2].media![0].type).toBe('image')
  })

  it('returns empty array for empty thread', () => {
    const messages = parseMessageThread('<mws-messages-list></mws-messages-list>')
    expect(messages).toHaveLength(0)
  })
})

describe('parseTimestamp', () => {
  it('handles time-of-day format', () => {
    const result = parseTimestamp('2:30 PM')
    expect(result).toContain('T')
    expect(result).toContain(':')
  })

  it('returns the input for unrecognized formats', () => {
    const result = parseTimestamp('Unknown format')
    expect(result).toBe('Unknown format')
  })

  it('handles "Yesterday"', () => {
    const result = parseTimestamp('Yesterday')
    expect(result).toContain('T')
  })
})
