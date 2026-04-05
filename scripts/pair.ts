/**
 * Standalone pairing script — launches headless Playwright, captures the QR code
 * as a screenshot, opens it for scanning, then waits for pairing to complete.
 *
 * Usage: npx tsx scripts/pair.ts
 */

import { chromium } from 'playwright'
import { SessionManager } from '../src/session'
import { SELECTORS } from '../src/selectors'
import { exec } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

const session = new SessionManager()
session.ensureDirectories()
session.killOrphan()

console.log('Launching headless browser for pairing...')

const browser = await chromium.launch({ headless: true })
session.writePid(browser.process?.()?.pid ?? 0)

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
})

const page = await context.newPage()
await page.goto('https://messages.google.com/web/authentication', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})

// Wait for QR code to appear
try {
  await page.waitForSelector(SELECTORS.pairing.qrCodeImg, { timeout: 20000 })
} catch {
  // Maybe already paired
  try {
    await page.waitForSelector(SELECTORS.app.mainContainer, { timeout: 5000 })
    const statePath = session.sessionStoragePath()
    await context.storageState({ path: `${statePath}/storage-state.json` })
    console.log('Already paired! Session saved.')
    await browser.close()
    session.removePid()
    process.exit(0)
  } catch {
    console.error('Could not find QR code or conversation list. Pairing page may have changed.')
    await browser.close()
    session.removePid()
    process.exit(1)
  }
}

// Screenshot the QR code and open it
const qrScreenshot = join(tmpdir(), 'google-messages-qr.png')
const qrElement = page.locator(SELECTORS.pairing.qrCodeImg).first()
await qrElement.screenshot({ path: qrScreenshot })

console.log('')
console.log(`QR code saved to: ${qrScreenshot}`)
console.log('Opening QR code image...')

// Open the screenshot with the default image viewer (Windows)
exec(`start "" "${qrScreenshot}"`)

console.log('')
console.log('Scan this QR code with your Android phone:')
console.log('  1. Open Google Messages')
console.log('  2. Tap your profile icon (top right)')
console.log('  3. Tap "Device pairing"')
console.log('  4. Tap "QR code scanner"')
console.log('  5. Scan the QR code shown in the image')
console.log('')
console.log('Waiting for pairing to complete (up to 2 minutes)...')

try {
  await page.waitForSelector(SELECTORS.app.mainContainer, { timeout: 120000 })
  console.log('')
  console.log('Pairing successful!')

  const statePath = session.sessionStoragePath()
  await context.storageState({ path: `${statePath}/storage-state.json` })
  console.log('Session saved. The plugin will work headlessly from now on.')
} catch {
  console.log('')
  console.log('Pairing timed out after 2 minutes. Please try again:')
  console.log('  npx tsx scripts/pair.ts')
}

await browser.close()
session.removePid()
