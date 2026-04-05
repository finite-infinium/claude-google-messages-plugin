import { describe, expect, it, beforeEach, afterEach } from 'vitest'
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
