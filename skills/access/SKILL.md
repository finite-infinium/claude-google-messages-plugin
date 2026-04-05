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
