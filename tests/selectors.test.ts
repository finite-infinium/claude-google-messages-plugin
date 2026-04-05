import { describe, expect, it } from 'vitest'
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
