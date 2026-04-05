export type ConsentMode = 'approve' | 'trust'

export interface Conversation {
  id: string
  name: string
  phoneNumber?: string
  isGroup: boolean
  lastMessage: string
  lastTimestamp: string
  unreadCount: number
  participants?: string[]
}

export interface Message {
  id: string
  sender: string
  text: string
  timestamp: string
  isOutgoing: boolean
  media?: MediaAttachment[]
  replyTo?: string
}

export interface MediaAttachment {
  type: 'image' | 'video' | 'audio' | 'file'
  filename?: string
  downloadable: boolean
}

export interface PluginConfig {
  consentMode: ConsentMode
  idleTimeoutMs: number
  healthCheckIntervalMs: number
  watchDefaultIntervalMs: number
}

export const DEFAULT_CONFIG: PluginConfig = {
  consentMode: 'approve',
  idleTimeoutMs: 5 * 60 * 1000,
  healthCheckIntervalMs: 30 * 1000,
  watchDefaultIntervalMs: 10 * 1000,
}
