import type { Message } from './types'

type PollCallback = () => Promise<Message[]>

interface WatchEntry {
  contact: string
  callback: PollCallback
  intervalMs: number
  timer: ReturnType<typeof setInterval>
}

export class WatcherManager {
  private watchers = new Map<string, WatchEntry>()
  private seenMessages = new Map<string, Set<string>>()
  private onNewMessage: ((contact: string, message: Message) => void) | null = null

  setNotificationHandler(handler: (contact: string, message: Message) => void): void {
    this.onNewMessage = handler
  }

  watch(contact: string, callback: PollCallback, intervalMs: number): void {
    this.unwatch(contact)

    const timer = setInterval(async () => {
      try {
        const messages = await callback()
        for (const msg of messages) {
          if (this.isNewMessage(contact, msg.id) && !msg.isOutgoing) {
            this.markSeen(contact, msg.id)
            this.onNewMessage?.(contact, msg)
          }
        }
      } catch (err) {
        process.stderr.write(`google-messages: watcher error for ${contact}: ${err}\n`)
      }
    }, intervalMs)
    timer.unref()

    this.watchers.set(contact, { contact, callback, intervalMs, timer })
  }

  unwatch(contact: string): void {
    const entry = this.watchers.get(contact)
    if (entry) {
      clearInterval(entry.timer)
      this.watchers.delete(contact)
    }
  }

  stopAll(): void {
    for (const [contact] of this.watchers) {
      this.unwatch(contact)
    }
    this.seenMessages.clear()
  }

  listWatchers(): string[] {
    return Array.from(this.watchers.keys())
  }

  isNewMessage(contact: string, messageId: string): boolean {
    const seen = this.seenMessages.get(contact)
    return !seen || !seen.has(messageId)
  }

  markSeen(contact: string, messageId: string): void {
    let seen = this.seenMessages.get(contact)
    if (!seen) {
      seen = new Set()
      this.seenMessages.set(contact, seen)
    }
    seen.add(messageId)

    if (seen.size > 500) {
      const arr = Array.from(seen)
      const trimmed = new Set(arr.slice(arr.length - 250))
      this.seenMessages.set(contact, trimmed)
    }
  }
}
