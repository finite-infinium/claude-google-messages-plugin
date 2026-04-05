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
git clone https://github.com/finite-infinium/claude-google-messages-plugin.git ~/claude-google-messages-plugin
cd ~/claude-google-messages-plugin
bash scripts/install.sh
```

Then restart Claude Code and run `/google-messages-setup` to pair your phone.

### Prerequisites

- [Node.js](https://nodejs.org) v18+
- Google Messages Android app on your phone
- Phone and PC on the same network (for initial pairing)

## Setup

1. Run `/google-messages-setup` in Claude Code
2. The plugin captures a QR code and displays it inline
3. On your Android phone: Google Messages > Profile > Device pairing > QR code scanner
4. Scan the code — done! The session is saved for headless use going forward.

Alternatively, run the standalone pairing script:
```bash
npx tsx scripts/pair.ts
```

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
| `pair` | Start QR code pairing (returns QR image inline) |
| `pair_complete` | Finalize pairing after QR scan |
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

## Architecture

The plugin runs as an MCP server using Node.js with [tsx](https://github.com/privatenumber/tsx) for TypeScript support. It automates [messages.google.com](https://messages.google.com) via [Playwright](https://playwright.dev) (headless Chromium).

> **Note:** [Bun](https://bun.sh) is not used as the runtime due to a [confirmed bug](https://github.com/oven-sh/bun/issues/15679) on Windows where Chromium's CDP pipe communication hangs. Tests still use Bun's test runner (`bun test`).
