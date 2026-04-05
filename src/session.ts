import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync } from 'fs'
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
