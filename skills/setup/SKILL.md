---
name: google-messages-setup
description: Set up Google Messages — pair your phone via QR code scanning. Use when the plugin reports it's not paired or on first-time setup.
user-invocable: true
allowed-tools:
  - mcp__google-messages__get_status
  - mcp__google-messages__pair
  - mcp__google-messages__pair_complete
---

# Google Messages Setup

Guide the user through pairing their Android phone with the Google Messages plugin.

## Steps

1. **Check current status** by calling the `get_status` tool.

2. **If already paired** (status shows "ready"), inform the user:
   > "Google Messages is already paired and ready. You can use tools like `list_conversations` and `read_messages` right away."

3. **If not paired** (status shows "pairing" or "stopped"):

   a. Call the `pair` tool. This launches a headless browser and returns the QR code as an image.

   b. Show the QR code image to the user and tell them:
   > **On your Android phone:**
   > 1. Open Google Messages
   > 2. Tap your profile icon (top right)
   > 3. Tap "Device pairing"
   > 4. Tap "QR code scanner"
   > 5. Scan the QR code shown above

   c. Once the user confirms they've scanned, call `pair_complete` to finalize the pairing.

   d. Verify success and inform the user.

4. **If pairing fails**, suggest:
   - Make sure the phone is connected to the internet
   - Try closing and reopening Google Messages on the phone
   - Run `/google-messages-setup` again to retry

## Notes

- Pairing persists across sessions — you only need to do this once
- If Google invalidates the pairing (rare), you'll be prompted to re-scan
- The browser runs headless at all times — no visible window needed
