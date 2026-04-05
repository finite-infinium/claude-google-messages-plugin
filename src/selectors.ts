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
