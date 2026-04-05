import type { Conversation, Message, MediaAttachment } from './types'

const PHONE_REGEX = /^\+?\d[\d\s\-().]{6,}$/

export function parseConversationList(html: string): Conversation[] {
  const conversations: Conversation[] = []

  const itemRegex = /<mws-conversation-list-item[^>]*?(?:data-e2e-conversation-id="([^"]*)")?[^>]*>([\s\S]*?)<\/mws-conversation-list-item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(html)) !== null) {
    const id = match[1] || `conv-${conversations.length}`
    const block = match[2]

    const name = extractTextContent(block, 'name')
    const snippet = extractTextContent(block, 'snippet')
    const timestamp = extractTextContent(block, 'timestamp')
    const unreadText = extractTextContent(block, 'unread-count')
    const unreadCount = unreadText ? parseInt(unreadText, 10) || 0 : 0

    const isPhone = PHONE_REGEX.test(name)

    conversations.push({
      id,
      name,
      phoneNumber: isPhone ? name : undefined,
      isGroup: !isPhone && snippet.includes(':'),
      lastMessage: snippet,
      lastTimestamp: parseTimestamp(timestamp),
      unreadCount,
    })
  }

  return conversations
}

export function parseMessageThread(html: string): Message[] {
  const messages: Message[] = []

  const msgRegex = /<mws-message-wrapper[^>]*class="([^"]*)"[^>]*?(?:data-message-id="([^"]*)")?[^>]*>([\s\S]*?)<\/mws-message-wrapper>/gi
  let match: RegExpExecArray | null

  while ((match = msgRegex.exec(html)) !== null) {
    const classes = match[1]
    const id = match[2] || `msg-${messages.length}`
    const block = match[3]

    const isOutgoing = classes.includes('outgoing')
    const senderName = extractTextContent(block, 'sender-name')
    const text = extractTextContent(block, 'text-msg')
    const timestamp = extractTextContent(block, 'timestamp')

    const media: MediaAttachment[] = []
    if (block.includes('media-container')) {
      if (block.includes('<img')) {
        media.push({ type: 'image', downloadable: true })
      } else if (block.includes('<video')) {
        media.push({ type: 'video', downloadable: true })
      } else {
        media.push({ type: 'file', downloadable: true })
      }
    }

    messages.push({
      id,
      sender: isOutgoing ? 'Me' : (senderName || 'Unknown'),
      text,
      timestamp: parseTimestamp(timestamp),
      isOutgoing,
      media: media.length > 0 ? media : undefined,
    })
  }

  return messages
}

export function parseTimestamp(raw: string): string {
  if (!raw) return new Date().toISOString()

  const now = new Date()

  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const period = timeMatch[3].toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
    return date.toISOString()
  }

  if (raw.toLowerCase() === 'yesterday') {
    const date = new Date(now)
    date.setDate(date.getDate() - 1)
    return date.toISOString()
  }

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const dayIndex = days.indexOf(raw.toLowerCase().slice(0, 3))
  if (dayIndex !== -1) {
    const date = new Date(now)
    const currentDay = date.getDay()
    let diff = currentDay - dayIndex
    if (diff <= 0) diff += 7
    date.setDate(date.getDate() - diff)
    return date.toISOString()
  }

  const parsed = new Date(raw)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return raw
}

function extractTextContent(html: string, className: string): string {
  const regex = new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i')
  const match = html.match(regex)
  if (!match) return ''
  return match[1].replace(/<[^>]*>/g, '').trim()
}
