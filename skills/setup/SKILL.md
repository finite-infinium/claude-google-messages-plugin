---
name: setup
description: Set up Google Messages — pair your phone via QR code scanning. Use when the plugin reports it's not paired or on first-time setup.
user-invocable: true
allowed-tools:
  - Read
  - Bash(bun *)
  - Bash(ls *)
---

# Google Messages Setup

Guide the user through pairing their Android phone with the Google Messages plugin.

## Steps

1. **Check current status** by calling the `get_status` tool.

2. **If already paired** (status shows "ready"), inform the user:
   > "Google Messages is already paired and ready. You can use tools like `list_conversations` and `read_messages` right away."

3. **If not paired** (status shows "pairing" or "stopped"):

   a. Tell the user:
   > "I need to pair with your Google Messages app. A browser window will open showing a QR code."
   > 
   > **On your Android phone:**
   > 1. Open the Google Messages app
   > 2. Tap your profile icon (top right)
   > 3. Tap "Device pairing"
   > 4. Tap "QR code scanner"
   > 5. Scan the QR code shown in the browser window
   
   b. The plugin will handle the pairing handshake automatically. Once the QR code is scanned, the browser switches to headless mode and the session is saved.

   c. Verify pairing by calling `get_status` again. Confirm success to the user.

4. **If pairing fails**, suggest:
   - Make sure the phone is connected to the internet
   - Try closing and reopening Google Messages on the phone
   - Run `/google-messages:setup` again to retry

## Notes

- Pairing persists across sessions — you only need to do this once
- If Google invalidates the pairing (rare), you'll be prompted to re-scan
- The browser runs headless after pairing — no visible window during normal use
