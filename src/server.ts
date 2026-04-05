#!/usr/bin/env npx tsx

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { exec } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { BrowserBridge } from './bridge'
import { SessionManager } from './session'
import { WatcherManager } from './watcher'
import { parseConversationList, parseMessageThread } from './parser'
import { SELECTORS } from './selectors'
import type { ConsentMode, Message } from './types'
import { DEFAULT_CONFIG } from './types'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export function buildToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'list_conversations',
      description: 'List recent conversations with previews (name, last message, timestamp, unread count).',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max conversations to return (default 20)' },
        },
      },
    },
    {
      name: 'read_messages',
      description: 'Read messages from a specific conversation by contact name.',
      inputSchema: {
        type: 'object',
        properties: {
          contact: { type: 'string', description: 'Contact name or phone number' },
          count: { type: 'number', description: 'Max messages to return (default 50)' },
          before: { type: 'string', description: 'Only messages before this ISO timestamp' },
          after: { type: 'string', description: 'Only messages after this ISO timestamp' },
        },
        required: ['contact'],
      },
    },
    {
      name: 'search_messages',
      description: 'Search across all conversations for a keyword or phrase.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          contact: { type: 'string', description: 'Optionally limit search to a specific contact' },
        },
        required: ['query'],
      },
    },
    {
      name: 'send_message',
      description: 'Send a message to a contact. In approve mode (default), returns a draft for confirmation unless confirmed=true.',
      inputSchema: {
        type: 'object',
        properties: {
          contact: { type: 'string', description: 'Contact name or phone number' },
          text: { type: 'string', description: 'Message text to send' },
          confirmed: { type: 'boolean', description: 'Set to true to skip draft preview and send immediately (approve mode only)' },
        },
        required: ['contact', 'text'],
      },
    },
    {
      name: 'reply',
      description: 'Reply to the currently open conversation. In approve mode (default), returns a draft for confirmation unless confirmed=true.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Reply text' },
          confirmed: { type: 'boolean', description: 'Set to true to skip draft preview and send immediately (approve mode only)' },
        },
        required: ['text'],
      },
    },
    {
      name: 'download_media',
      description: 'Download an image or file from a message in a conversation.',
      inputSchema: {
        type: 'object',
        properties: {
          conversation: { type: 'string', description: 'Contact name or conversation ID' },
          message_id: { type: 'string', description: 'ID of the message containing the media' },
        },
        required: ['conversation', 'message_id'],
      },
    },
    {
      name: 'pair',
      description: 'Start the QR code pairing flow. Launches a headless browser, captures the QR code as an image, and returns it for the user to scan.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'pair_complete',
      description: 'Wait for an in-progress QR code pairing to complete. Call this after the user has scanned the QR code from the `pair` tool.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_status',
      description: 'Check pairing status, current consent mode, and active watchers.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'set_consent_mode',
      description: 'Toggle between "approve" (default — drafts before sending) and "trust" (sends immediately) mode.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['approve', 'trust'], description: 'Consent mode' },
        },
        required: ['mode'],
      },
    },
    {
      name: 'watch_conversation',
      description: 'Start polling a conversation for new incoming messages. New messages are surfaced as notifications.',
      inputSchema: {
        type: 'object',
        properties: {
          contact: { type: 'string', description: 'Contact name to watch' },
          interval_seconds: { type: 'number', description: 'Poll interval in seconds (default 10)' },
        },
        required: ['contact'],
      },
    },
    {
      name: 'unwatch_conversation',
      description: 'Stop watching a conversation for new messages.',
      inputSchema: {
        type: 'object',
        properties: {
          contact: { type: 'string', description: 'Contact name to stop watching' },
        },
        required: ['contact'],
      },
    },
  ]
}

export function handleConsentCheck(
  mode: ConsentMode,
  contact: string,
  text: string,
  confirmed: boolean
): { shouldSend: boolean; draftMessage?: string } {
  if (mode === 'trust' || confirmed) {
    return { shouldSend: true }
  }
  return {
    shouldSend: false,
    draftMessage: `DRAFT MESSAGE\n\nTo: ${contact}\nMessage: ${text}\n\nCall this tool again with confirmed=true to send, or modify the message.`,
  }
}

// --- Server bootstrap (only runs when executed directly) ---

const isMainModule = (typeof Bun !== 'undefined' && import.meta.main) ||
  (typeof Bun === 'undefined' && import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`)

if (isMainModule) {
  const session = new SessionManager()
  const bridge = new BrowserBridge(session)
  const watcher = new WatcherManager()
  let consentMode: ConsentMode = 'approve'

  const mcp = new Server(
    { name: 'google-messages', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions: [
        'Google Messages plugin — read, search, and reply to SMS/RCS messages via browser automation of messages.google.com.',
        '',
        '## Tools',
        'Read-only tools (list_conversations, read_messages, search_messages, get_status) work immediately.',
        'Write tools (send_message, reply) require consent:',
        '- Default "approve" mode: returns a draft preview. Re-call with confirmed=true to send.',
        '- "trust" mode: sends immediately. Enable with set_consent_mode("trust"). Resets on session end.',
        'Messages include sender name, text, timestamp, and media indicators.',
        '',
        '## First-time setup',
        'If get_status shows the plugin is not paired, guide the user through pairing:',
        '1. A browser window will open showing a QR code from messages.google.com.',
        '2. On the Android phone: open Google Messages > tap profile icon (top right) > Device pairing > QR code scanner.',
        '3. Scan the QR code. The plugin handles the rest — browser switches to headless and session is saved.',
        '4. Pairing persists across sessions. Re-scan only needed if Google invalidates it (rare).',
        '',
        '## Consent modes',
        '- "approve" (default): send_message and reply return a draft preview first. Call again with confirmed=true to send.',
        '- "trust": messages send immediately. Useful for batch operations or when user grants standing permission.',
        '- Trust mode resets to "approve" at the start of each new session.',
        '- Read-only tools never require consent.',
        '- Check current mode with get_status. Change with set_consent_mode.',
      ].join('\n'),
    },
  )

  watcher.setNotificationHandler((contact, message) => {
    bridge.touchActivity()
    mcp.notification({
      method: 'notifications/google-messages/new_message',
      params: {
        contact,
        message: {
          id: message.id,
          sender: message.sender,
          text: message.text,
          timestamp: message.timestamp,
        },
      },
    }).catch(err => {
      process.stderr.write(`google-messages: notification failed: ${err}\n`)
    })
  })

  mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildToolDefinitions(),
  }))

  mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>
    try {
      switch (req.params.name) {
        case 'pair': {
          const currentStatus = bridge.getStatus()
          if (currentStatus === 'ready') {
            return { content: [{ type: 'text', text: 'Already paired and ready. No action needed.' }] }
          }

          // Launch headless and capture QR code
          await bridge.launchForPairing()
          const qrBase64 = await bridge.captureQrCode()

          if (!qrBase64) {
            // No QR code found — might already be paired
            const recheckStatus = bridge.getStatus()
            if (recheckStatus === 'ready') {
              return { content: [{ type: 'text', text: 'Already paired! No QR code needed.' }] }
            }
            return { content: [{ type: 'text', text: 'Could not capture QR code. The Google Messages pairing page may have changed.' }], isError: true }
          }

          // Save QR code to temp file and open in default image viewer
          const qrPath = join(tmpdir(), 'google-messages-qr.png')
          writeFileSync(qrPath, Buffer.from(qrBase64, 'base64'))
          exec(`start "" "${qrPath}"`)

          return {
            content: [{
              type: 'text',
              text: `QR code opened in your image viewer (${qrPath}).\n\nScan it with your Android phone:\n1. Open Google Messages\n2. Tap your profile icon (top right)\n3. Tap "Device pairing"\n4. Tap "QR code scanner"\n5. Scan the QR code\n\nOnce scanned, call the \`pair_complete\` tool to finish pairing.`,
            }],
          }
        }

        case 'pair_complete': {
          if (bridge.getStatus() === 'ready') {
            return { content: [{ type: 'text', text: 'Already paired and ready.' }] }
          }
          if (bridge.getStatus() !== 'pairing') {
            return { content: [{ type: 'text', text: 'No pairing in progress. Call `pair` first.' }], isError: true }
          }
          const success = await bridge.waitForPairing(120000)
          if (success) {
            return { content: [{ type: 'text', text: 'Pairing successful! Google Messages is now connected.' }] }
          }
          return { content: [{ type: 'text', text: 'Pairing timed out. Please try again by calling `pair`.' }], isError: true }
        }

        case 'get_status': {
          const status = bridge.getStatus()
          const watchers = watcher.listWatchers()
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ pairing: status, consentMode, activeWatchers: watchers }, null, 2),
            }],
          }
        }

        case 'set_consent_mode': {
          const mode = args.mode as ConsentMode
          if (mode !== 'approve' && mode !== 'trust') {
            throw new Error('Invalid mode. Must be "approve" or "trust".')
          }
          consentMode = mode
          return { content: [{ type: 'text', text: `Consent mode set to "${mode}".` }] }
        }

        case 'list_conversations': {
          const page = await bridge.ensureReady()
          const limit = (args.limit as number) ?? 20
          const html = await page.locator(SELECTORS.conversationList.container).innerHTML({ timeout: 10000 })
          const conversations = parseConversationList(html).slice(0, limit)
          return {
            content: [{
              type: 'text',
              text: conversations.length === 0
                ? '(no conversations found)'
                : conversations.map(c => {
                    const unread = c.unreadCount > 0 ? ` [${c.unreadCount} unread]` : ''
                    const phone = c.phoneNumber ? ` (${c.phoneNumber})` : ''
                    return `${c.name}${phone}${unread} — ${c.lastMessage} (${c.lastTimestamp})`
                  }).join('\n'),
            }],
          }
        }

        case 'read_messages': {
          const contact = args.contact as string
          const count = (args.count as number) ?? 50
          await bridge.openConversation(contact)
          const page = bridge.getPage()!
          const html = await page.locator(SELECTORS.messageThread.container).innerHTML({ timeout: 10000 })
          let messages = parseMessageThread(html)
          if (args.before) {
            const before = new Date(args.before as string).getTime()
            messages = messages.filter(m => new Date(m.timestamp).getTime() < before)
          }
          if (args.after) {
            const after = new Date(args.after as string).getTime()
            messages = messages.filter(m => new Date(m.timestamp).getTime() > after)
          }
          messages = messages.slice(-count)
          for (const msg of messages) {
            watcher.markSeen(contact, msg.id)
          }
          return {
            content: [{
              type: 'text',
              text: messages.length === 0
                ? '(no messages found)'
                : messages.map(m => {
                    const media = m.media ? ` [${m.media.map(a => a.type).join(', ')}]` : ''
                    return `[${m.timestamp}] ${m.sender}: ${m.text}${media}  (id: ${m.id})`
                  }).join('\n'),
            }],
          }
        }

        case 'search_messages': {
          const query = args.query as string
          const page = await bridge.ensureReady()
          await bridge.searchMessages(query)
          const html = await page.locator(SELECTORS.conversationList.container).innerHTML({ timeout: 10000 })
          const conversations = parseConversationList(html)
          return {
            content: [{
              type: 'text',
              text: conversations.length === 0
                ? `(no results for "${query}")`
                : `Search results for "${query}":\n` + conversations.map(c =>
                    `${c.name} — ${c.lastMessage} (${c.lastTimestamp})`
                  ).join('\n'),
            }],
          }
        }

        case 'send_message': {
          const contact = args.contact as string
          const text = args.text as string
          const confirmed = (args.confirmed as boolean) ?? false
          const check = handleConsentCheck(consentMode, contact, text, confirmed)
          if (!check.shouldSend) {
            return { content: [{ type: 'text', text: check.draftMessage! }] }
          }
          await bridge.openConversation(contact)
          await bridge.sendMessageInCurrentThread(text)
          return { content: [{ type: 'text', text: `Message sent to ${contact}.` }] }
        }

        case 'reply': {
          const text = args.text as string
          const confirmed = (args.confirmed as boolean) ?? false
          const check = handleConsentCheck(consentMode, 'current conversation', text, confirmed)
          if (!check.shouldSend) {
            return { content: [{ type: 'text', text: check.draftMessage! }] }
          }
          await bridge.sendMessageInCurrentThread(text)
          return { content: [{ type: 'text', text: 'Reply sent.' }] }
        }

        case 'download_media': {
          const conversation = args.conversation as string
          const messageId = args.message_id as string
          await bridge.openConversation(conversation)
          const page = bridge.getPage()!
          const msgLocator = page.locator(`${SELECTORS.messageThread.message}[data-message-id="${messageId}"]`)
          const mediaLocator = msgLocator.locator(SELECTORS.messageThread.mediaAttachment).first()
          const exists = await mediaLocator.count() > 0
          if (!exists) {
            return { content: [{ type: 'text', text: 'No media found in this message.' }] }
          }
          const imgSrc = await mediaLocator.locator('img').getAttribute('src').catch(() => null)
          if (imgSrc) {
            return { content: [{ type: 'text', text: `Media URL: ${imgSrc}\n(Note: blob URLs are only accessible within the browser session)` }] }
          }
          return { content: [{ type: 'text', text: 'Media found but could not extract download URL.' }] }
        }

        case 'watch_conversation': {
          const contact = args.contact as string
          const intervalMs = ((args.interval_seconds as number) ?? 10) * 1000
          watcher.watch(
            contact,
            async () => {
              await bridge.openConversation(contact)
              const page = bridge.getPage()!
              const html = await page.locator(SELECTORS.messageThread.container).innerHTML({ timeout: 10000 })
              return parseMessageThread(html).slice(-10)
            },
            intervalMs,
          )
          return { content: [{ type: 'text', text: `Now watching "${contact}" for new messages (every ${intervalMs / 1000}s).` }] }
        }

        case 'unwatch_conversation': {
          const contact = args.contact as string
          watcher.unwatch(contact)
          return { content: [{ type: 'text', text: `Stopped watching "${contact}".` }] }
        }

        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { content: [{ type: 'text', text: `${req.params.name} failed: ${msg}` }], isError: true }
    }
  })

  await mcp.connect(new StdioServerTransport())

  let shuttingDown = false
  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    process.stderr.write('google-messages: shutting down\n')
    watcher.stopAll()
    await bridge.shutdown()
    setTimeout(() => process.exit(0), 2000)
  }

  process.stdin.on('end', () => void shutdown())
  process.stdin.on('close', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
  process.on('beforeExit', () => void shutdown())
}
