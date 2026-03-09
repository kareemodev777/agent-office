#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.agent-office.plist"
PLIST_SRC="$PROJECT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "[Agent Office] Building project..."
cd "$PROJECT_DIR"
npm run build

# Detect node path
NODE_PATH=$(which node)
echo "[Agent Office] Node path: $NODE_PATH"

# Update plist with correct paths
sed -e "s|/usr/local/bin/node|$NODE_PATH|g" \
    -e "s|/Users/kareemo/Projects/agent-office|$PROJECT_DIR|g" \
    -e "s|/Users/kareemo/Library/Logs|$HOME/Library/Logs|g" \
    "$PLIST_SRC" > "$PLIST_DEST"

echo "[Agent Office] Installed plist to $PLIST_DEST"

# Unload if already loaded (ignore errors)
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# Load the service
launchctl load "$PLIST_DEST"
echo "[Agent Office] Service loaded and running!"
echo "[Agent Office] Open http://localhost:3737 in your browser"
echo ""
echo "To uninstall: npm run uninstall-service"
