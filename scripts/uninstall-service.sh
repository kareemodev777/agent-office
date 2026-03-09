#!/bin/bash
set -e

PLIST_NAME="com.agent-office.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

if [ -f "$PLIST_DEST" ]; then
  echo "[Agent Office] Unloading service..."
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  rm "$PLIST_DEST"
  echo "[Agent Office] Service uninstalled."
else
  echo "[Agent Office] Service not installed."
fi
