#!/usr/bin/env bash
set -euo pipefail

# Google Messages MCP Plugin — Global Installer
# Installs dependencies, Chromium, registers with Claude Code, creates data dirs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MCP_CONFIG="$HOME/.claude/.mcp.json"
DATA_DIR="$HOME/.claude/google-messages"

echo "=== Google Messages MCP Plugin Installer ==="
echo ""
echo "Plugin directory: $PLUGIN_DIR"
echo ""

# 1. Install Node dependencies
echo "[1/4] Installing dependencies..."
cd "$PLUGIN_DIR"
bun install

# 2. Install Playwright Chromium
echo "[2/4] Installing Chromium for Playwright..."
bunx playwright install chromium

# 3. Register MCP server in ~/.claude/.mcp.json
echo "[3/4] Registering MCP server..."
mkdir -p "$(dirname "$MCP_CONFIG")"

# Read existing config or start fresh
if [ -f "$MCP_CONFIG" ]; then
  EXISTING=$(cat "$MCP_CONFIG")
else
  EXISTING='{"mcpServers":{}}'
fi

# Use bun to merge the config (avoids jq dependency)
NEW_CONFIG=$(bun -e "
const existing = JSON.parse(\`$EXISTING\`);
existing.mcpServers = existing.mcpServers || {};
existing.mcpServers['google-messages'] = {
  command: 'bun',
  args: ['run', '--cwd', '$PLUGIN_DIR', '--shell=bun', '--silent', 'start']
};
console.log(JSON.stringify(existing, null, 2));
")

echo "$NEW_CONFIG" > "$MCP_CONFIG"
echo "  Registered in $MCP_CONFIG"

# 4. Create data directories
echo "[4/4] Creating data directories..."
mkdir -p "$DATA_DIR/session"

# Create default config if it doesn't exist
if [ ! -f "$DATA_DIR/config.json" ]; then
  cat > "$DATA_DIR/config.json" << 'CONFIGEOF'
{
  "consentMode": "approve",
  "idleTimeoutMs": 300000,
  "healthCheckIntervalMs": 30000,
  "watchDefaultIntervalMs": 10000
}
CONFIGEOF
  echo "  Created default config at $DATA_DIR/config.json"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code (or start a new session)"
echo "  2. Run /google-messages:setup to pair your phone"
echo ""
