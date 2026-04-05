#!/usr/bin/env bash
set -euo pipefail

# Google Messages MCP Plugin — Global Installer
# Installs dependencies, Chromium, registers with Claude Code, creates data dirs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLAUDE_CONFIG="$HOME/.claude.json"
DATA_DIR="$HOME/.claude/google-messages"

echo "=== Google Messages MCP Plugin Installer ==="
echo ""
echo "Plugin directory: $PLUGIN_DIR"
echo ""

# 1. Install Node dependencies
echo "[1/4] Installing dependencies..."
cd "$PLUGIN_DIR"
npm install

# 2. Install Playwright Chromium
echo "[2/4] Installing Chromium for Playwright..."
npx playwright install chromium

# 3. Register MCP server in ~/.claude.json (global Claude Code config)
echo "[3/4] Registering MCP server..."

node -e "
const fs = require('fs');
const configPath = process.argv[1];
const serverPath = process.argv[2];
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers['google-messages'] = {
  type: 'stdio',
  command: 'npx',
  args: ['tsx', serverPath]
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
" "$CLAUDE_CONFIG" "$PLUGIN_DIR/src/server.ts"

echo "  Registered MCP server in $CLAUDE_CONFIG"

# 3b. Install global skills to ~/.claude/skills/
SKILLS_DIR="$HOME/.claude/skills"
mkdir -p "$SKILLS_DIR/google-messages-setup" "$SKILLS_DIR/google-messages-access"
cp "$PLUGIN_DIR/skills/setup/SKILL.md" "$SKILLS_DIR/google-messages-setup/SKILL.md"
cp "$PLUGIN_DIR/skills/access/SKILL.md" "$SKILLS_DIR/google-messages-access/SKILL.md"
echo "  Installed skills to $SKILLS_DIR"

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
echo "  2. Run /google-messages-setup to pair your phone"
echo ""
