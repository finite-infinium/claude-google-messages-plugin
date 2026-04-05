# Google Messages MCP Plugin — Design Spec

## Overview

An MCP server plugin for Claude Code that interfaces with Google Messages via Playwright browser automation of the messages.google.com web client. Allows Claude to read, search, and reply to SMS/RCS messages with user-controlled consent.

## Goals

- Read and search message conversations from any Claude Code session
- Draft and send replies with consent gating (approve-by-default, trust mode opt-in)
- Minimal phone-side setup — QR code scan only, no Android app required
- Full SMS + RCS support including group chats, media, reactions
- Real-time monitoring as an opt-in mode for specific conversations
- Global installability via a single install script

## Architecture

```
Claude Code <-> MCP Server (stdio) <-> Browser Bridge (Playwright) <-> messages.google.com <-> Phone
```

### Layer 1: MCP Server (`src/server.ts`)

Entry point discovered by Claude Code. Implements the MCP protocol via `@modelcontextprotocol/sdk`. Exposes tools, handles consent logic, manages session lifecycle.

**Consent system:**
- Two modes: `approve` (default) and `trust`
- In `approve` mode, `send_message` and `reply` accept an optional `confirmed: boolean` flag. Without `confirmed: true`, they return a draft preview (the message text and recipient) as the tool result. Claude then presents this to the user and, upon approval, re-calls the tool with `confirmed: true` to actually send
- In `trust` mode, messages send immediately without confirmation
- Mode is toggled via `set_consent_mode` tool and resets to `approve` on session end
- Read-only tools (list, read, search) never require consent

### Layer 2: Browser Bridge (`src/bridge.ts`)

Manages a persistent headless Chromium instance via Playwright.

**Pairing:**
- On first use, navigates to messages.google.com and captures the QR code
- QR code is rendered in-terminal (text-based) or shown via a brief visible browser window
- Session data (cookies, local storage) persisted to `~/.claude/google-messages/session/`
- On subsequent launches, restores session to avoid re-pairing
- Detects pairing loss and prompts re-scan when needed

**DOM interaction strategy (resilience-ordered):**
1. ARIA roles and accessibility attributes (most stable)
2. Text content matching (contact names, message text)
3. Structural patterns (scrollable containers, list hierarchies)

All selectors centralized in `src/selectors.ts` for easy maintenance.

**Browser lifecycle management:**
- **Lazy startup:** The browser does NOT launch when the MCP server starts. It launches on the first tool call that needs it (e.g., `list_conversations`), keeping startup fast and resource-free until actually needed.
- **Idle timeout:** After a configurable period of inactivity (default 5 minutes with no tool calls), the browser gracefully shuts down. It re-launches automatically on the next tool call.
- **Graceful shutdown:** On MCP server disconnect (Claude Code session ends), the server sends `browser.close()` and waits up to 5 seconds for clean exit. If the browser doesn't respond, it kills the process via PID.
- **Orphan protection:** On startup, the server checks for stale PID files in `~/.claude/google-messages/` and kills any orphaned Chromium processes from previous crashed sessions before launching a new one.
- **Process tracking:** The browser's PID is written to `~/.claude/google-messages/browser.pid` and removed on clean shutdown. This enables orphan detection.
- **Signal handling:** The MCP server registers handlers for `SIGTERM`, `SIGINT`, and `beforeExit` to ensure browser cleanup even on unexpected termination.
- **Health checks:** Periodic lightweight ping (every 30s) to verify the browser process is still responsive. If it hangs or crashes, the PID file is cleaned up and the next tool call triggers a fresh launch.

### Layer 3: Session & State Manager (`src/session.ts`)

- Persists browser session across MCP server restarts
- Stores consent preferences in `~/.claude/google-messages/config.json`
- Manages real-time watcher state

## MCP Tools

### Read-only (no consent required)

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_conversations` | Recent conversations with previews | `limit?: number` |
| `read_messages` | Messages from a conversation | `contact: string, count?: number, before?: string, after?: string` |
| `search_messages` | Search across all conversations | `query: string, contact?: string` |
| `download_media` | Download image/file from a message | `conversation: string, message_id: string` |
| `get_status` | Pairing status, consent mode, active watchers | none |

### Write (consent required)

| Tool | Description | Parameters |
|------|-------------|------------|
| `send_message` | Send to a contact/conversation | `contact: string, text: string, confirmed?: boolean` |
| `reply` | Reply to currently active conversation | `text: string, confirmed?: boolean` |

### Control

| Tool | Description | Parameters |
|------|-------------|------------|
| `set_consent_mode` | Toggle approve/trust mode | `mode: "approve" \| "trust"` |
| `watch_conversation` | Start polling for new messages | `contact: string, interval_seconds?: number` |
| `unwatch_conversation` | Stop watching | `contact: string` |

## Message Data Model

```typescript
interface Conversation {
  id: string;
  name: string;            // Contact name or group name
  phoneNumber?: string;    // Visible for individual chats (may be absent for saved contacts)
  isGroup: boolean;
  lastMessage: string;
  lastTimestamp: string;    // ISO 8601
  unreadCount: number;
  participants?: string[];  // Group chats only
}

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;       // ISO 8601
  isOutgoing: boolean;
  media?: MediaAttachment[];
  replyTo?: string;        // ID of message being replied to
}

interface MediaAttachment {
  type: "image" | "video" | "audio" | "file";
  filename?: string;
  downloadable: boolean;
}
```

## Real-Time Monitoring

- `watch_conversation` starts a polling loop (default 10s interval) on a specific conversation
- New messages are surfaced via MCP notifications (`notifications/google-messages/new_message`)
- Multiple conversations can be watched simultaneously
- All watchers stop when the MCP server session ends
- Real-time mode is opt-in only; default usage is on-demand

## DOM Parsing (`src/parser.ts`)

Extracts structured data from the Google Messages web UI:
- Conversation list: name, preview text, timestamp, unread badge
- Message thread: per-message sender, text, timestamp, media indicators
- Group chat sender attribution from message bubbles
- Read receipts and delivery status where available

Outputs normalized `Conversation[]` and `Message[]` types.

## Project Structure

```
claude-google-messages-plugin/
  .claude-plugin/
    plugin.json
  .mcp.json
  package.json
  tsconfig.json
  scripts/
    install.sh              # One-command setup
  src/
    server.ts               # MCP server — tools, consent, lifecycle
    bridge.ts               # Playwright browser management
    parser.ts               # DOM -> structured message data
    selectors.ts            # Centralized DOM selectors
    session.ts              # Pairing persistence, config storage
    watcher.ts              # Real-time polling engine
    types.ts                # Shared TypeScript types
  skills/
    setup/
      SKILL.md              # /google-messages:setup — QR pairing guide
    access/
      SKILL.md              # /google-messages:access — consent management
  README.md
```

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `playwright` — browser automation (Chromium only)
- `bun` — runtime

## Installation

### Install script (`scripts/install.sh`)

Performs:
1. `bun install` — install Node dependencies
2. `bunx playwright install chromium` — install browser binary
3. Register MCP server in `~/.claude/.mcp.json`:
   ```json
   {
     "mcpServers": {
       "google-messages": {
         "command": "bun",
         "args": ["run", "--cwd", "<install-path>", "start"],
         "env": {}
       }
     }
   }
   ```
4. Create data directories (`~/.claude/google-messages/session/`, `~/.claude/google-messages/config.json`)

### First-time setup

After install, user runs `/google-messages:setup` in any Claude Code session which:
1. Checks pairing status
2. If unpaired, launches browser and displays QR code
3. User scans with Google Messages Android app
4. Pairing confirmed and session saved

## Data Storage

| Path | Purpose |
|------|---------|
| `~/.claude/google-messages/session/` | Playwright browser context (cookies, local storage) |
| `~/.claude/google-messages/config.json` | Persistent settings (default consent mode) |

## Security Considerations

- No credentials stored — pairing is session-based (Google handles auth)
- Consent mode resets to `approve` on each new Claude Code session by default
- Trust mode requires explicit user action to enable
- Browser runs headless — no visible window during normal operation
- Session data stored in user's home directory with standard file permissions

## Future Considerations (Out of Scope)

- Migration to mautrix/gmessages protocol if Playwright approach becomes too brittle
- Scheduled message sending
- Contact management
- MMS media sending (currently read-only for media)
