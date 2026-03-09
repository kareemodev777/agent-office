#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=3737
URL="http://localhost:$PORT"

# Check if server is already running
if ! curl -s "$URL" > /dev/null 2>&1; then
  echo "[Agent Office] Starting server..."
  cd "$PROJECT_DIR"
  node server/dist/index.js &
  SERVER_PID=$!

  # Wait for server to be ready
  for i in $(seq 1 30); do
    if curl -s "$URL" > /dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
  echo "[Agent Office] Server started (PID: $SERVER_PID)"
fi

# Try to open in Chrome app mode, fall back to default browser
if [ -d "/Applications/Google Chrome.app" ]; then
  echo "[Agent Office] Opening in Chrome app mode..."
  open -na 'Google Chrome' --args --app="$URL" --window-size=1200,800
elif [ -d "/Applications/Chromium.app" ]; then
  open -na 'Chromium' --args --app="$URL" --window-size=1200,800
else
  echo "[Agent Office] Opening in default browser..."
  open "$URL"
fi
