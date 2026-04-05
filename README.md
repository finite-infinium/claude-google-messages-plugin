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
