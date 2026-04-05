# Google Messages MCP Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server plugin that lets Claude Code read, search, and reply to Google Messages via Playwright browser automation of messages.google.com.

**Architecture:** Three-layer system — MCP server (tool definitions + consent logic) → Browser bridge (Playwright headless Chromium with lazy startup/idle shutdown) → DOM parser (extracts structured message data from the Google Messages web UI). Session persistence avoids re-pairing across restarts.

**Tech Stack:** TypeScript, Bun, `@modelcontextprotocol/sdk`, Playwright (Chromium), MCP plugin format for Claude Code.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `.claude-plugin/plugin.json` | Plugin metadata for Claude Code discovery |
| `.mcp.json` | MCP server launch configuration |
| `package.json` | Dependencies and start script |
| `tsconfig.json` | TypeScript compiler config |
| `src/types.ts` | Shared TypeScript interfaces (Conversation, Message, MediaAttachment, Config) |
| `src/selectors.ts` | All DOM selectors for Google Messages web UI, centralized |
| `src/session.ts` | Pairing persistence, config read/write, PID file management |
| `src/bridge.ts` | Playwright browser lifecycle — launch, pair, navigate, idle timeout, cleanup |
| `src/parser.ts` | DOM → structured data extraction (conversations list, message thread) |
| `src/watcher.ts` | Real-time polling engine for watched conversations |
| `src/server.ts` | MCP server entry point — tool definitions, consent logic, signal handling |
| `scripts/install.sh` | One-command global install (deps, Chromium, MCP registration, data dirs) |
| `skills/setup/SKILL.md` | `/google-messages:setup` skill — guides QR pairing |
| `skills/access/SKILL.md` | `/google-messages:access` skill — consent management |
| `tests/types.test.ts` | Type validation tests |
| `tests/selectors.test.ts` | Selector structure tests |
| `tests/session.test.ts` | Session manager unit tests |
| `tests/parser.test.ts` | Parser unit tests with mock HTML |
| `tests/watcher.test.ts` | Watcher unit tests |
| `tests/server.test.ts` | MCP server tool handler tests |

---

### Task 1: Project Scaffold

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.mcp.json`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create plugin metadata**

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "google-messages",
  "description": "Google Messages channel for Claude Code — read, search, and reply to SMS/RCS messages via browser automation. Manage setup via /google-messages:setup.",
  "version": "0.1.0",
  "keywords": [
    "google-messages",
    "sms",
    "rcs",
    "messaging",
    "channel",
    "mcp"
  ]
}
```

- [ ] **Step 2: Create MCP server launch config**

Create `.mcp.json`:

```json
{
  "mcpServers": {
    "google-messages": {
      "command": "bun",
      "args": ["run", "--cwd", "${CLAUDE_PLUGIN_ROOT}", "--shell=bun", "--silent", "start"]
    }
  }
}
```

- [ ] **Step 3: Create package.json**

Create `package.json`:

```json
{
  "name": "claude-google-messages-plugin",
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "bin": "./src/server.ts",
  "scripts": {
    "start": "bun install --no-summary && bun src/server.ts",
    "test": "bun test"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "playwright": "^1.52.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 5: Install dependencies**

Run: `bun install`
Expected: Dependencies installed, `bun.lockb` created.

- [ ] **Step 6: Commit scaffold**

```bash
git add .claude-plugin/ .mcp.json package.json tsconfig.json bun.lockb
git commit -m "feat: project scaffold with plugin metadata and dependencies"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/types.ts`
- Create: `tests/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/types.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/types.test.ts`
Expected: FAIL — cannot find module `../src/types`

- [ ] **Step 3: Write the types implementation**

Create `src/types.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/types.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: shared TypeScript types for conversations, messages, and config"
```

---

### Task 3: DOM Selectors

**Files:**
- Create: `src/selectors.ts`
- Create: `tests/selectors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/selectors.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { SELECTORS } from '../src/selectors'

describe('selectors', () => {
  it('has pairing screen selectors', () => {
    expect(SELECTORS.pairing.qrCodeImg).toBeDefined()
    expect(SELECTORS.pairing.rememberToggle).toBeDefined()
    expect(SELECTORS.pairing.authContainer).toBeDefined()
  })

  it('has conversation list selectors', () => {
    expect(SELECTORS.conversationList.container).toBeDefined()
    expect(SELECTORS.conversationList.item).toBeDefined()
    expect(SELECTORS.conversationList.itemName).toBeDefined()
    expect(SELECTORS.conversationList.itemPreview).toBeDefined()
    expect(SELECTORS.conversationList.itemTimestamp).toBeDefined()
    expect(SELECTORS.conversationList.itemUnreadBadge).toBeDefined()
  })

  it('has message thread selectors', () => {
    expect(SELECTORS.messageThread.container).toBeDefined()
    expect(SELECTORS.messageThread.message).toBeDefined()
    expect(SELECTORS.messageThread.messageText).toBeDefined()
    expect(SELECTORS.messageThread.messageTimestamp).toBeDefined()
    expect(SELECTORS.messageThread.outgoingMessage).toBeDefined()
    expect(SELECTORS.messageThread.incomingMessage).toBeDefined()
    expect(SELECTORS.messageThread.senderName).toBeDefined()
    expect(SELECTORS.messageThread.mediaAttachment).toBeDefined()
  })

  it('has compose area selectors', () => {
    expect(SELECTORS.compose.input).toBeDefined()
    expect(SELECTORS.compose.sendButton).toBeDefined()
  })

  it('has app state selectors', () => {
    expect(SELECTORS.app.mainContainer).toBeDefined()
    expect(SELECTORS.app.loadingSpinner).toBeDefined()
    expect(SELECTORS.app.searchInput).toBeDefined()
  })

  it('all selector values are non-empty strings', () => {
    function checkSelectors(obj: Record<string, unknown>, path = ''): void {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key
        if (typeof value === 'object' && value !== null) {
          checkSelectors(value as Record<string, unknown>, fullPath)
        } else {
          expect(typeof value).toBe('string')
          expect((value as string).length).toBeGreaterThan(0)
        }
      }
    }
    checkSelectors(SELECTORS)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/selectors.test.ts`
Expected: FAIL — cannot find module `../src/selectors`

- [ ] **Step 3: Write the selectors implementation**

Create `src/selectors.ts`:

```typescript
/**
 * Centralized DOM selectors for Google Messages web UI.
 *
 * Google Messages is an Angular app using custom elements with mw-/mws- prefixes.
 * These custom element tags have been stable across years of updates, making them
 * the most reliable anchors. ARIA roles are used where available as primary selectors.
 *
 * Strategy (resilience-ordered):
 * 1. ARIA roles and accessibility attributes (most stable)
 * 2. Custom element tag names (mw-*, mws-* — stable for years)
 * 3. Text content / attribute matching (fallback)
 */

export const SELECTORS = {
  pairing: {
    /** QR code image on the auth page */
    qrCodeImg: 'img[alt*="QR code"]',
    /** "Remember this computer" toggle */
    rememberToggle: 'role=switch[name="Remember this computer"]',
    /** Auth page container — present when unpaired */
    authContainer: 'mw-authentication-container',
  },

  conversationList: {
    /** The nav element wrapping all conversation items */
    container: 'mws-conversations-list nav',
    /** Individual conversation row */
    item: 'mws-conversation-list-item',
    /** Contact or group name within a conversation item */
    itemName: 'mws-conversation-list-item .name',
    /** Preview text of the last message */
    itemPreview: 'mws-conversation-list-item .snippet',
    /** Relative timestamp (e.g., "2:30 PM", "Yesterday") */
    itemTimestamp: 'mws-conversation-list-item .timestamp',
    /** Unread message count badge */
    itemUnreadBadge: 'mws-conversation-list-item .unread-count',
  },

  messageThread: {
    /** The scrollable message thread container */
    container: 'mws-messages-list',
    /** Individual message wrapper */
    message: 'mws-message-wrapper',
    /** The text content within a message bubble */
    messageText: 'mws-message-wrapper .text-msg',
    /** Timestamp shown on a message */
    messageTimestamp: 'mws-message-wrapper .timestamp',
    /** Outgoing (sent by user) message — identified by class */
    outgoingMessage: 'mws-message-wrapper.outgoing',
    /** Incoming (received) message — identified by class */
    incomingMessage: 'mws-message-wrapper.incoming',
    /** Sender name in group chats */
    senderName: 'mws-message-wrapper .sender-name',
    /** Media attachment indicator within a message */
    mediaAttachment: 'mws-message-wrapper .media-container',
  },

  compose: {
    /** Message input field */
    input: 'textarea[aria-label*="message" i], [contenteditable][aria-label*="message" i]',
    /** Send button */
    sendButton: 'button[aria-label*="Send" i]',
  },

  app: {
    /** Main container — present when paired and loaded */
    mainContainer: 'mw-main-container',
    /** Loading spinner during initial load */
    loadingSpinner: 'mw-loading-spinner',
    /** Search input in the conversation list */
    searchInput: 'mws-conversations-list input[aria-label*="Search" i], mw-search-bar input',
  },
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/selectors.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/selectors.ts tests/selectors.test.ts
git commit -m "feat: centralized DOM selectors for Google Messages web UI"
```

---

### Task 4: Session Manager

**Files:**
- Create: `src/session.ts`
- Create: `tests/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/session.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SessionManager } from '../src/session'
import type { PluginConfig } from '../src/types'
import { DEFAULT_CONFIG } from '../src/types'

describe('SessionManager', () => {
  let tempDir: string
  let session: SessionManager

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'gm-test-'))
    session = new SessionManager(tempDir)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('data directories', () => {
    it('creates data directory structure on ensureDirectories', () => {
      session.ensureDirectories()
      expect(existsSync(join(tempDir, 'session'))).toBe(true)
    })

    it('is idempotent', () => {
      session.ensureDirectories()
      session.ensureDirectories()
      expect(existsSync(join(tempDir, 'session'))).toBe(true)
    })
  })

  describe('config', () => {
    it('returns default config when no file exists', () => {
      const config = session.loadConfig()
      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('saves and loads config', () => {
      session.ensureDirectories()
      const config: PluginConfig = {
        ...DEFAULT_CONFIG,
        consentMode: 'trust',
      }
      session.saveConfig(config)
      const loaded = session.loadConfig()
      expect(loaded.consentMode).toBe('trust')
    })

    it('falls back to defaults on corrupted config', () => {
      session.ensureDirectories()
      writeFileSync(join(tempDir, 'config.json'), 'not json')
      const config = session.loadConfig()
      expect(config).toEqual(DEFAULT_CONFIG)
    })
  })

  describe('PID file', () => {
    it('writes and reads browser PID', () => {
      session.ensureDirectories()
      session.writePid(12345)
      expect(session.readPid()).toBe(12345)
    })

    it('returns null when no PID file exists', () => {
      expect(session.readPid()).toBeNull()
    })

    it('removes PID file', () => {
      session.ensureDirectories()
      session.writePid(12345)
      session.removePid()
      expect(session.readPid()).toBeNull()
    })

    it('returns null for corrupted PID file', () => {
      session.ensureDirectories()
      writeFileSync(join(tempDir, 'browser.pid'), 'not-a-number')
      expect(session.readPid()).toBeNull()
    })
  })

  describe('session storage path', () => {
    it('returns path to session subdirectory', () => {
      const path = session.sessionStoragePath()
      expect(path).toBe(join(tempDir, 'session'))
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/session.test.ts`
Expected: FAIL — cannot find module `../src/session`

- [ ] **Step 3: Write the session manager implementation**

Create `src/session.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { PluginConfig } from './types'
import { DEFAULT_CONFIG } from './types'

export class SessionManager {
  readonly dataDir: string

  constructor(dataDir?: string) {
    this.dataDir = dataDir ?? join(homedir(), '.claude', 'google-messages')
  }

  ensureDirectories(): void {
    mkdirSync(join(this.dataDir, 'session'), { recursive: true })
  }

  sessionStoragePath(): string {
    return join(this.dataDir, 'session')
  }

  private configPath(): string {
    return join(this.dataDir, 'config.json')
  }

  private pidPath(): string {
    return join(this.dataDir, 'browser.pid')
  }

  loadConfig(): PluginConfig {
    try {
      const raw = readFileSync(this.configPath(), 'utf8')
      const parsed = JSON.parse(raw) as Partial<PluginConfig>
      return {
        consentMode: parsed.consentMode ?? DEFAULT_CONFIG.consentMode,
        idleTimeoutMs: parsed.idleTimeoutMs ?? DEFAULT_CONFIG.idleTimeoutMs,
        healthCheckIntervalMs: parsed.healthCheckIntervalMs ?? DEFAULT_CONFIG.healthCheckIntervalMs,
        watchDefaultIntervalMs: parsed.watchDefaultIntervalMs ?? DEFAULT_CONFIG.watchDefaultIntervalMs,
      }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  saveConfig(config: PluginConfig): void {
    this.ensureDirectories()
    const tmp = this.configPath() + '.tmp'
    writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n')
    // Atomic rename
    const { renameSync } = require('fs')
    renameSync(tmp, this.configPath())
  }

  writePid(pid: number): void {
    writeFileSync(this.pidPath(), String(pid))
  }

  readPid(): number | null {
    try {
      const raw = readFileSync(this.pidPath(), 'utf8').trim()
      const pid = parseInt(raw, 10)
      return isNaN(pid) ? null : pid
    } catch {
      return null
    }
  }

  removePid(): void {
    try {
      rmSync(this.pidPath(), { force: true })
    } catch {}
  }

  /** Kill an orphaned browser process from a previous crashed session. */
  killOrphan(): void {
    const pid = this.readPid()
    if (pid === null) return
    try {
      process.kill(pid, 0) // Check if process exists
      process.kill(pid, 'SIGTERM')
      process.stderr.write(`google-messages: killed orphaned browser process ${pid}\n`)
    } catch {
      // Process doesn't exist — just clean up the stale PID file
    }
    this.removePid()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/session.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session.ts tests/session.test.ts
git commit -m "feat: session manager for config persistence and browser PID tracking"
```

---

### Task 5: Browser Bridge

**Files:**
- Create: `src/bridge.ts`

This module manages the Playwright browser lifecycle. It is tested via integration tests (Task 10) rather than unit tests because it requires a real browser. The core logic (lazy startup, idle timeout, health checks, graceful shutdown) is all here.

- [ ] **Step 1: Write the browser bridge**

Create `src/bridge.ts`:

```typescript
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { SELECTORS } from './selectors'
import { SessionManager } from './session'
import { DEFAULT_CONFIG } from './types'

export type BridgeStatus = 'stopped' | 'launching' | 'pairing' | 'ready' | 'error'

export class BrowserBridge {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private status: BridgeStatus = 'stopped'
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private lastActivity: number = Date.now()
  private readonly session: SessionManager
  private idleTimeoutMs: number
  private healthCheckIntervalMs: number

  constructor(session: SessionManager) {
    this.session = session
    const config = session.loadConfig()
    this.idleTimeoutMs = config.idleTimeoutMs ?? DEFAULT_CONFIG.idleTimeoutMs
    this.healthCheckIntervalMs = config.healthCheckIntervalMs ?? DEFAULT_CONFIG.healthCheckIntervalMs
  }

  getStatus(): BridgeStatus {
    return this.status
  }

  getPage(): Page | null {
    return this.page
  }

  /** Ensure the browser is running and paired. Launches lazily on first call. */
  async ensureReady(): Promise<Page> {
    this.touchActivity()

    if (this.status === 'ready' && this.page && !this.page.isClosed()) {
      return this.page
    }

    if (this.status === 'launching') {
      // Wait for launch to complete
      await this.waitForStatus('ready', 60000)
      return this.page!
    }

    await this.launch()

    if (this.status === 'pairing') {
      throw new Error(
        'Google Messages is not paired. Run /google-messages:setup to scan the QR code.'
      )
    }

    if (this.status !== 'ready' || !this.page) {
      throw new Error(`Browser bridge is in unexpected state: ${this.status}`)
    }

    return this.page
  }

  /** Launch the browser and navigate to Google Messages. */
  async launch(): Promise<void> {
    if (this.status === 'launching') return

    this.status = 'launching'
    this.session.ensureDirectories()
    this.session.killOrphan()

    try {
      this.browser = await chromium.launch({ headless: true })
      this.session.writePid(this.browser.process()!.pid!)

      // Restore session from persistent storage if available
      this.context = await this.browser.newContext({
        storageState: await this.loadStorageState(),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      })

      this.page = await this.context.newPage()
      await this.page.goto('https://messages.google.com/web/conversations', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Determine if we're paired or need QR scan
      const isPaired = await this.checkPaired()
      if (isPaired) {
        this.status = 'ready'
        await this.saveStorageState()
        this.startIdleTimer()
        this.startHealthChecks()
      } else {
        this.status = 'pairing'
      }
    } catch (err) {
      this.status = 'error'
      await this.shutdown()
      throw err
    }
  }

  /**
   * Launch in visible mode for QR code scanning.
   * Returns the page so the caller can wait for pairing completion.
   */
  async launchForPairing(): Promise<Page> {
    this.session.ensureDirectories()
    this.session.killOrphan()

    this.status = 'launching'

    this.browser = await chromium.launch({ headless: false })
    this.session.writePid(this.browser.process()!.pid!)

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    })

    this.page = await this.context.newPage()
    await this.page.goto('https://messages.google.com/web/authentication', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    this.status = 'pairing'
    return this.page
  }

  /** Wait for pairing to complete after QR scan. */
  async waitForPairing(timeoutMs = 120000): Promise<boolean> {
    if (!this.page) return false

    try {
      await this.page.waitForSelector(SELECTORS.app.mainContainer, { timeout: timeoutMs })
      this.status = 'ready'
      await this.saveStorageState()

      // Switch to headless for future operations
      const storageState = await this.context!.storageState()
      await this.shutdown()

      this.browser = await chromium.launch({ headless: true })
      this.session.writePid(this.browser.process()!.pid!)
      this.context = await this.browser.newContext({
        storageState,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      })
      this.page = await this.context.newPage()
      await this.page.goto('https://messages.google.com/web/conversations', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      this.status = 'ready'
      this.startIdleTimer()
      this.startHealthChecks()
      return true
    } catch {
      return false
    }
  }

  /** Gracefully shut down the browser. */
  async shutdown(): Promise<void> {
    this.stopIdleTimer()
    this.stopHealthChecks()

    if (this.page && !this.page.isClosed()) {
      try { await this.page.close() } catch {}
    }
    if (this.context) {
      try { await this.context.close() } catch {}
    }
    if (this.browser) {
      try {
        await Promise.race([
          this.browser.close(),
          new Promise(resolve => setTimeout(resolve, 5000)),
        ])
      } catch {}

      // Force kill if still running
      try {
        const pid = this.browser.process()?.pid
        if (pid) process.kill(pid, 'SIGKILL')
      } catch {}
    }

    this.browser = null
    this.context = null
    this.page = null
    this.session.removePid()
    this.status = 'stopped'
  }

  /** Record activity to reset idle timer. Called by ensureReady and externally. */
  touchActivity(): void {
    this.lastActivity = Date.now()
    this.resetIdleTimer()
  }

  /** Navigate to a specific conversation by clicking on it. */
  async openConversation(contactName: string): Promise<void> {
    const page = await this.ensureReady()

    // Click on the conversation in the sidebar
    const item = page.locator(SELECTORS.conversationList.item).filter({
      hasText: contactName,
    }).first()

    await item.click({ timeout: 10000 })

    // Wait for the message thread to load
    await page.waitForSelector(SELECTORS.messageThread.container, { timeout: 10000 })
  }

  /** Type and send a message in the currently open conversation. */
  async sendMessageInCurrentThread(text: string): Promise<void> {
    const page = await this.ensureReady()

    const input = page.locator(SELECTORS.compose.input).first()
    await input.click()
    await input.fill(text)

    const sendBtn = page.locator(SELECTORS.compose.sendButton).first()
    await sendBtn.click({ timeout: 5000 })

    // Brief wait for send confirmation
    await page.waitForTimeout(500)
  }

  /** Navigate to search and search for a query. */
  async searchMessages(query: string): Promise<void> {
    const page = await this.ensureReady()

    const searchInput = page.locator(SELECTORS.app.searchInput).first()
    await searchInput.click()
    await searchInput.fill(query)
    await page.keyboard.press('Enter')

    // Wait for search results to load
    await page.waitForTimeout(1500)
  }

  // --- Private helpers ---

  private async checkPaired(): Promise<boolean> {
    if (!this.page) return false
    try {
      // Check for main container (indicates paired) vs auth container (indicates unpaired)
      const result = await Promise.race([
        this.page.waitForSelector(SELECTORS.app.mainContainer, { timeout: 15000 })
          .then(() => true),
        this.page.waitForSelector(SELECTORS.pairing.qrCodeImg, { timeout: 15000 })
          .then(() => false),
      ])
      return result
    } catch {
      return false
    }
  }

  private async loadStorageState(): Promise<string | undefined> {
    const statePath = this.session.sessionStoragePath()
    const stateFile = `${statePath}/storage-state.json`
    try {
      const { existsSync } = await import('fs')
      if (existsSync(stateFile)) {
        return stateFile
      }
    } catch {}
    return undefined
  }

  private async saveStorageState(): Promise<void> {
    if (!this.context) return
    const statePath = this.session.sessionStoragePath()
    const stateFile = `${statePath}/storage-state.json`
    try {
      await this.context.storageState({ path: stateFile })
    } catch (err) {
      process.stderr.write(`google-messages: failed to save storage state: ${err}\n`)
    }
  }

  private startIdleTimer(): void {
    this.stopIdleTimer()
    this.idleTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > this.idleTimeoutMs) {
        process.stderr.write('google-messages: idle timeout — shutting down browser\n')
        void this.shutdown()
      }
    }, 30000)
    this.idleTimer.unref()
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer)
      this.idleTimer = null
    }
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      this.startIdleTimer()
    }
  }

  private startHealthChecks(): void {
    this.stopHealthChecks()
    this.healthTimer = setInterval(async () => {
      if (!this.page || this.page.isClosed()) {
        process.stderr.write('google-messages: browser health check failed — page closed\n')
        this.status = 'stopped'
        this.session.removePid()
        this.stopHealthChecks()
        return
      }
      try {
        await this.page.evaluate(() => true)
      } catch {
        process.stderr.write('google-messages: browser health check failed — page unresponsive\n')
        await this.shutdown()
      }
    }, this.healthCheckIntervalMs)
    this.healthTimer.unref()
  }

  private stopHealthChecks(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  private async waitForStatus(target: BridgeStatus, timeoutMs: number): Promise<void> {
    const start = Date.now()
    while (this.status !== target && Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    if (this.status !== target) {
      throw new Error(`Timed out waiting for browser status "${target}" (current: "${this.status}")`)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bridge.ts
git commit -m "feat: Playwright browser bridge with lazy startup, idle timeout, and health checks"
```

---

### Task 6: DOM Parser

**Files:**
- Create: `src/parser.ts`
- Create: `tests/parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/parser.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
import { parseConversationList, parseMessageThread, parseTimestamp } from '../src/parser'

// Mock HTML fragments matching Google Messages web UI structure

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/parser.test.ts`
Expected: FAIL — cannot find module `../src/parser`

- [ ] **Step 3: Write the parser implementation**

Create `src/parser.ts`:

```typescript
import type { Conversation, Message, MediaAttachment } from './types'

// Lightweight HTML parsing using regex — no DOM dependency needed for
// extracting structured data from the known Google Messages markup.
// This avoids pulling in heavy dependencies like jsdom for what amounts
// to scraping a known, consistent structure.

const PHONE_REGEX = /^\+?\d[\d\s\-().]{6,}$/

/**
 * Parse conversation list HTML into structured Conversation objects.
 * Expects the innerHTML of the conversation list nav element.
 */
export function parseConversationList(html: string): Conversation[] {
  const conversations: Conversation[] = []

  // Match each conversation-list-item block
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

/**
 * Parse message thread HTML into structured Message objects.
 * Expects the innerHTML of the messages-list element.
 */
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

    // Detect media
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

/**
 * Parse a Google Messages timestamp string into ISO 8601 format.
 * Google Messages uses relative timestamps: "2:30 PM", "Yesterday", "Mon", "Apr 3".
 */
export function parseTimestamp(raw: string): string {
  if (!raw) return new Date().toISOString()

  const now = new Date()

  // Time-of-day: "2:30 PM", "11:45 AM"
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

  // "Yesterday"
  if (raw.toLowerCase() === 'yesterday') {
    const date = new Date(now)
    date.setDate(date.getDate() - 1)
    return date.toISOString()
  }

  // Day of week: "Mon", "Tue", etc.
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

  // Try native Date parsing as fallback
  const parsed = new Date(raw)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  // Return raw if nothing works
  return raw
}

/** Extract text content from a div with a given class name. */
function extractTextContent(html: string, className: string): string {
  const regex = new RegExp(`<div[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i')
  const match = html.match(regex)
  if (!match) return ''
  // Strip inner HTML tags and trim
  return match[1].replace(/<[^>]*>/g, '').trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/parser.test.ts`
Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parser.ts tests/parser.test.ts
git commit -m "feat: DOM parser for conversation list and message thread extraction"
```

---

### Task 7: Watcher Engine

**Files:**
- Create: `src/watcher.ts`
- Create: `tests/watcher.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/watcher.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { WatcherManager } from '../src/watcher'
import type { Message } from '../src/types'

describe('WatcherManager', () => {
  let manager: WatcherManager

  beforeEach(() => {
    manager = new WatcherManager()
  })

  afterEach(() => {
    manager.stopAll()
  })

  it('starts with no active watchers', () => {
    expect(manager.listWatchers()).toEqual([])
  })

  it('registers a watcher', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    expect(manager.listWatchers()).toEqual(['Alice'])
  })

  it('removes a watcher', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    manager.unwatch('Alice')
    expect(manager.listWatchers()).toEqual([])
  })

  it('does not duplicate watchers for the same contact', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    manager.watch('Alice', callback, 5000)
    expect(manager.listWatchers()).toEqual(['Alice'])
  })

  it('stops all watchers', () => {
    const callback = async () => []
    manager.watch('Alice', callback, 10000)
    manager.watch('Bob', callback, 10000)
    manager.stopAll()
    expect(manager.listWatchers()).toEqual([])
  })

  it('tracks last known message IDs to detect new messages', () => {
    expect(manager.isNewMessage('Alice', 'msg-1')).toBe(true)
    manager.markSeen('Alice', 'msg-1')
    expect(manager.isNewMessage('Alice', 'msg-1')).toBe(false)
    expect(manager.isNewMessage('Alice', 'msg-2')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/watcher.test.ts`
Expected: FAIL — cannot find module `../src/watcher`

- [ ] **Step 3: Write the watcher implementation**

Create `src/watcher.ts`:

```typescript
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

  /** Register a callback for new message notifications. */
  setNotificationHandler(handler: (contact: string, message: Message) => void): void {
    this.onNewMessage = handler
  }

  /** Start watching a conversation. The callback should return recent messages. */
  watch(contact: string, callback: PollCallback, intervalMs: number): void {
    // Stop existing watcher for this contact if any
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

  /** Stop watching a conversation. */
  unwatch(contact: string): void {
    const entry = this.watchers.get(contact)
    if (entry) {
      clearInterval(entry.timer)
      this.watchers.delete(contact)
    }
  }

  /** Stop all watchers. */
  stopAll(): void {
    for (const [contact] of this.watchers) {
      this.unwatch(contact)
    }
    this.seenMessages.clear()
  }

  /** List currently watched contacts. */
  listWatchers(): string[] {
    return Array.from(this.watchers.keys())
  }

  /** Check if a message ID is new (not seen before) for a contact. */
  isNewMessage(contact: string, messageId: string): boolean {
    const seen = this.seenMessages.get(contact)
    return !seen || !seen.has(messageId)
  }

  /** Mark a message ID as seen for a contact. */
  markSeen(contact: string, messageId: string): void {
    let seen = this.seenMessages.get(contact)
    if (!seen) {
      seen = new Set()
      this.seenMessages.set(contact, seen)
    }
    seen.add(messageId)

    // Cap seen set at 500 to prevent unbounded growth
    if (seen.size > 500) {
      const arr = Array.from(seen)
      const trimmed = new Set(arr.slice(arr.length - 250))
      this.seenMessages.set(contact, trimmed)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/watcher.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/watcher.ts tests/watcher.test.ts
git commit -m "feat: watcher manager for real-time conversation monitoring"
```

---

### Task 8: MCP Server

**Files:**
- Create: `src/server.ts`
- Create: `tests/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/server.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/server.test.ts`
Expected: FAIL — cannot find module `../src/server`

- [ ] **Step 3: Write the MCP server implementation**

Create `src/server.ts`:

```typescript
#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { BrowserBridge } from './bridge'
import { SessionManager } from './session'
import { WatcherManager } from './watcher'
import { parseConversationList, parseMessageThread } from './parser'
import { SELECTORS } from './selectors'
import type { ConsentMode, Message } from './types'
import { DEFAULT_CONFIG } from './types'

// --- Exported for testing ---

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
    draftMessage: `📋 DRAFT MESSAGE\n\nTo: ${contact}\nMessage: ${text}\n\nCall this tool again with confirmed=true to send, or modify the message.`,
  }
}

// --- Server bootstrap (only runs when executed directly) ---

const isMainModule = typeof Bun !== 'undefined'
  ? import.meta.main
  : require.main === module

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
        'Google Messages plugin — read, search, and reply to SMS/RCS messages.',
        '',
        'Tools prefixed with google-messages. Read-only tools (list_conversations, read_messages, search_messages) work immediately. Write tools (send_message, reply) require consent:',
        '- Default "approve" mode: returns a draft preview. Re-call with confirmed=true to send.',
        '- "trust" mode: sends immediately. Enable with set_consent_mode("trust"). Resets on session end.',
        '',
        'First-time setup: run /google-messages:setup to pair via QR code.',
        'Messages include sender name, text, timestamp, and media indicators.',
      ].join('\n'),
    },
  )

  // Set up watcher notifications
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
        case 'get_status': {
          const status = bridge.getStatus()
          const watchers = watcher.listWatchers()
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                pairing: status,
                consentMode,
                activeWatchers: watchers,
              }, null, 2),
            }],
          }
        }

        case 'set_consent_mode': {
          const mode = args.mode as ConsentMode
          if (mode !== 'approve' && mode !== 'trust') {
            throw new Error('Invalid mode. Must be "approve" or "trust".')
          }
          consentMode = mode
          return {
            content: [{ type: 'text', text: `Consent mode set to "${mode}".` }],
          }
        }

        case 'list_conversations': {
          const page = await bridge.ensureReady()
          const limit = (args.limit as number) ?? 20

          // Get conversation list HTML
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

          // Apply time filters if provided
          if (args.before) {
            const before = new Date(args.before as string).getTime()
            messages = messages.filter(m => new Date(m.timestamp).getTime() < before)
          }
          if (args.after) {
            const after = new Date(args.after as string).getTime()
            messages = messages.filter(m => new Date(m.timestamp).getTime() > after)
          }

          messages = messages.slice(-count)

          // Mark these as seen for watcher purposes
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

          // After search, the UI shows matching conversations
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

          return {
            content: [{ type: 'text', text: `Message sent to ${contact}.` }],
          }
        }

        case 'reply': {
          const text = args.text as string
          const confirmed = (args.confirmed as boolean) ?? false

          const check = handleConsentCheck(consentMode, 'current conversation', text, confirmed)
          if (!check.shouldSend) {
            return { content: [{ type: 'text', text: check.draftMessage! }] }
          }

          await bridge.sendMessageInCurrentThread(text)

          return {
            content: [{ type: 'text', text: 'Reply sent.' }],
          }
        }

        case 'download_media': {
          const conversation = args.conversation as string
          const messageId = args.message_id as string

          await bridge.openConversation(conversation)
          const page = bridge.getPage()!

          // Find the specific message and its media
          const msgLocator = page.locator(`${SELECTORS.messageThread.message}[data-message-id="${messageId}"]`)
          const mediaLocator = msgLocator.locator(SELECTORS.messageThread.mediaAttachment).first()

          const exists = await mediaLocator.count() > 0
          if (!exists) {
            return { content: [{ type: 'text', text: 'No media found in this message.' }] }
          }

          // Right-click and save or extract URL
          const imgSrc = await mediaLocator.locator('img').getAttribute('src').catch(() => null)
          if (imgSrc) {
            return {
              content: [{ type: 'text', text: `Media URL: ${imgSrc}\n(Note: blob URLs are only accessible within the browser session)` }],
            }
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

          return {
            content: [{ type: 'text', text: `Now watching "${contact}" for new messages (every ${intervalMs / 1000}s).` }],
          }
        }

        case 'unwatch_conversation': {
          const contact = args.contact as string
          watcher.unwatch(contact)
          return {
            content: [{ type: 'text', text: `Stopped watching "${contact}".` }],
          }
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
            isError: true,
          }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text', text: `${req.params.name} failed: ${msg}` }],
        isError: true,
      }
    }
  })

  // Connect MCP transport
  await mcp.connect(new StdioServerTransport())

  // Graceful shutdown
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/server.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts tests/server.test.ts
git commit -m "feat: MCP server with all tool handlers, consent system, and graceful shutdown"
```

---

### Task 9: Skills

**Files:**
- Create: `skills/setup/SKILL.md`
- Create: `skills/access/SKILL.md`

- [ ] **Step 1: Create the setup skill**

Create `skills/setup/SKILL.md`:

```markdown
---
name: setup
description: Set up Google Messages — pair your phone via QR code scanning. Use when the plugin reports it's not paired or on first-time setup.
user-invocable: true
allowed-tools:
  - Read
  - Bash(bun *)
  - Bash(ls *)
---

# Google Messages Setup

Guide the user through pairing their Android phone with the Google Messages plugin.

## Steps

1. **Check current status** by calling the `get_status` tool.

2. **If already paired** (status shows "ready"), inform the user:
   > "Google Messages is already paired and ready. You can use tools like `list_conversations` and `read_messages` right away."

3. **If not paired** (status shows "pairing" or "stopped"):

   a. Tell the user:
   > "I need to pair with your Google Messages app. A browser window will open showing a QR code."
   > 
   > **On your Android phone:**
   > 1. Open the Google Messages app
   > 2. Tap your profile icon (top right)
   > 3. Tap "Device pairing"
   > 4. Tap "QR code scanner"
   > 5. Scan the QR code shown in the browser window
   
   b. The plugin will handle the pairing handshake automatically. Once the QR code is scanned, the browser switches to headless mode and the session is saved.

   c. Verify pairing by calling `get_status` again. Confirm success to the user.

4. **If pairing fails**, suggest:
   - Make sure the phone is connected to the internet
   - Try closing and reopening Google Messages on the phone
   - Run `/google-messages:setup` again to retry

## Notes

- Pairing persists across sessions — you only need to do this once
- If Google invalidates the pairing (rare), you'll be prompted to re-scan
- The browser runs headless after pairing — no visible window during normal use
```

- [ ] **Step 2: Create the access/consent skill**

Create `skills/access/SKILL.md`:

```markdown
---
name: access
description: Manage Google Messages consent settings — view or change whether messages require approval before sending. Use when the user asks about permissions or consent mode.
user-invocable: true
allowed-tools:
  - Read
---

# Google Messages Consent Management

Help the user understand and manage the consent system for sending messages.

## Consent Modes

- **approve** (default): When Claude drafts a message via `send_message` or `reply`, it shows a preview first. The user must confirm before it actually sends. This is the safe default.

- **trust**: Messages send immediately without preview/confirmation. Useful for batch operations or when the user has explicitly granted standing permission.

## How to Change

To check current mode, call `get_status`.

To change mode:
- "Set consent mode to trust" → calls `set_consent_mode` with `mode: "trust"`
- "Go back to approve mode" → calls `set_consent_mode` with `mode: "approve"`

## Important

- Trust mode resets to "approve" at the start of each new Claude Code session
- The user can revoke trust mode at any time by saying "go back to approve mode"
- Read-only tools (listing, reading, searching messages) never require consent
```

- [ ] **Step 3: Commit**

```bash
git add skills/
git commit -m "feat: setup and access skills for pairing and consent management"
```

---

### Task 10: Install Script

**Files:**
- Create: `scripts/install.sh`

- [ ] **Step 1: Write the install script**

Create `scripts/install.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Google Messages MCP Plugin — Global Installer
# Installs dependencies, Chromium, registers with Claude Code, creates data dirs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_CONFIG="$HOME/.claude/.mcp.json"
DATA_DIR="$HOME/.claude/google-messages"

echo "=== Google Messages MCP Plugin Installer ==="
echo ""
echo "Plugin directory: $PLUGIN_DIR"
echo ""

# 1. Install Node dependencies
echo "[1/4] Installing dependencies..."
cd "$PLUGIN_DIR"
bun install

# 2. Install Playwright Chromium
echo "[2/4] Installing Chromium for Playwright..."
bunx playwright install chromium

# 3. Register MCP server in ~/.claude/.mcp.json
echo "[3/4] Registering MCP server..."
mkdir -p "$(dirname "$MCP_CONFIG")"

# Read existing config or start fresh
if [ -f "$MCP_CONFIG" ]; then
  EXISTING=$(cat "$MCP_CONFIG")
else
  EXISTING='{"mcpServers":{}}'
fi

# Use bun to merge the config (avoids jq dependency)
NEW_CONFIG=$(bun -e "
const existing = JSON.parse(\`$EXISTING\`);
existing.mcpServers = existing.mcpServers || {};
existing.mcpServers['google-messages'] = {
  command: 'bun',
  args: ['run', '--cwd', '$PLUGIN_DIR', '--shell=bun', '--silent', 'start']
};
console.log(JSON.stringify(existing, null, 2));
")

echo "$NEW_CONFIG" > "$MCP_CONFIG"
echo "  Registered in $MCP_CONFIG"

# 4. Create data directories
echo "[4/4] Creating data directories..."
mkdir -p "$DATA_DIR/session"

# Create default config if it doesn't exist
if [ ! -f "$DATA_DIR/config.json" ]; then
  cat > "$DATA_DIR/config.json" << 'CONFIGEOF'
{
  "consentMode": "approve",
  "idleTimeoutMs": 300000,
  "healthCheckIntervalMs": 30000,
  "watchDefaultIntervalMs": 10000
}
CONFIGEOF
  echo "  Created default config at $DATA_DIR/config.json"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code (or start a new session)"
echo "  2. Run /google-messages:setup to pair your phone"
echo ""
```

- [ ] **Step 2: Make it executable and commit**

```bash
chmod +x scripts/install.sh
git add scripts/install.sh
git commit -m "feat: global install script for one-command setup"
```

---

### Task 11: README and Final Polish

**Files:**
- Create: `README.md`
- Create: `.gitignore`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
bun.lockb
.superpowers/
*.pid
```

- [ ] **Step 2: Create README**

Create `README.md`:

```markdown
# Google Messages MCP Plugin for Claude Code

Read, search, and reply to your SMS/RCS messages from any Claude Code session via Google Messages for Web.

## Features

- **Read conversations** — list recent chats, read message threads, search across all conversations
- **Send messages** — compose and send with consent-gated approval (or trust mode for batch operations)
- **Real-time monitoring** — opt-in polling for new messages in specific conversations
- **Persistent pairing** — scan a QR code once, stays paired across sessions
- **Lazy browser** — Chromium only runs when you use messaging tools, auto-shuts down after 5 min idle

## Quick Install

```bash
git clone <repo-url> ~/claude-google-messages-plugin
cd ~/claude-google-messages-plugin
bash scripts/install.sh
```

Then restart Claude Code and run `/google-messages:setup` to pair your phone.

## Setup

1. Run `/google-messages:setup` in Claude Code
2. A browser window opens with a QR code
3. On your Android phone: Google Messages → Profile → Device pairing → QR code scanner
4. Scan the code — done! The browser goes headless and you're paired.

## Usage

**Reading messages:**
- "Check my recent messages"
- "What did Alice say?"
- "Search my messages for 'dinner plans'"

**Sending messages:**
- "Text Alice: Running 10 minutes late"
- "Reply: Sounds good, see you there"

**Consent modes:**
- Default: drafts are shown for your approval before sending
- Trust mode: "Send messages without asking" — sends immediately, revoke anytime

**Real-time:**
- "Watch for messages from Alice"
- "Stop watching Alice"

## Tools

| Tool | Description |
|------|-------------|
| `list_conversations` | Recent conversations with previews |
| `read_messages` | Read a conversation thread |
| `search_messages` | Search across all conversations |
| `send_message` | Send a message (consent-gated) |
| `reply` | Reply to current conversation (consent-gated) |
| `download_media` | Download images/files from messages |
| `get_status` | Check pairing and consent status |
| `set_consent_mode` | Toggle approve/trust mode |
| `watch_conversation` | Start real-time monitoring |
| `unwatch_conversation` | Stop monitoring |

## Requirements

- [Bun](https://bun.sh) runtime
- Google Messages Android app on your phone
- Phone and PC on the same network (for initial pairing)
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "docs: README with setup guide and usage examples"
```

---

### Task 12: Run All Tests

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: All tests across types, selectors, session, parser, watcher, and server pass.

- [ ] **Step 2: Verify the MCP server starts without errors**

Run: `echo '{}' | timeout 3 bun src/server.ts 2>&1 || true`
Expected: Server starts and exits cleanly when stdin closes. No crash or unhandled errors.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found in final test run"
```
