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
      await this.waitForStatus('ready', 60000)
      return this.page!
    }

    await this.launch()

    if (this.status === 'pairing') {
      throw new Error(
        'Google Messages is not paired. Run /google-messages-setup to scan the QR code.'
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
      this.session.writePid(this.browser.process?.()?.pid ?? 0)

      this.context = await this.browser.newContext({
        storageState: await this.loadStorageState(),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      })

      this.page = await this.context.newPage()
      await this.page.goto('https://messages.google.com/web/conversations', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

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
   * Launch headless for QR code pairing.
   * Returns the page so the caller can capture the QR code and wait for pairing.
   */
  async launchForPairing(): Promise<Page> {
    this.session.ensureDirectories()
    this.session.killOrphan()

    this.status = 'launching'

    this.browser = await chromium.launch({ headless: true })
    this.session.writePid(this.browser.process?.()?.pid ?? 0)

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

  /** Capture the QR code as a base64-encoded PNG. Returns null if no QR code found. */
  async captureQrCode(): Promise<string | null> {
    if (!this.page) return null
    try {
      await this.page.waitForSelector(SELECTORS.pairing.qrCodeImg, { timeout: 20000 })
      const qrElement = this.page.locator(SELECTORS.pairing.qrCodeImg).first()
      const buffer = await qrElement.screenshot()
      return buffer.toString('base64')
    } catch {
      return null
    }
  }

  /** Wait for pairing to complete after QR scan. */
  async waitForPairing(timeoutMs = 120000): Promise<boolean> {
    if (!this.page) return false

    try {
      await this.page.waitForSelector(SELECTORS.app.mainContainer, { timeout: timeoutMs })
      this.status = 'ready'
      await this.saveStorageState()

      const storageState = await this.context!.storageState()
      await this.shutdown()

      this.browser = await chromium.launch({ headless: true })
      this.session.writePid(this.browser.process?.()?.pid ?? 0)
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

      try {
        const pid = this.browser.process?.()?.pid
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

    const item = page.locator(SELECTORS.conversationList.item).filter({
      hasText: contactName,
    }).first()

    await item.click({ timeout: 10000 })
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

    await page.waitForTimeout(500)
  }

  /** Navigate to search and search for a query. */
  async searchMessages(query: string): Promise<void> {
    const page = await this.ensureReady()

    const searchInput = page.locator(SELECTORS.app.searchInput).first()
    await searchInput.click()
    await searchInput.fill(query)
    await page.keyboard.press('Enter')

    await page.waitForTimeout(1500)
  }

  // --- Private helpers ---

  private async checkPaired(): Promise<boolean> {
    if (!this.page) return false
    try {
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
