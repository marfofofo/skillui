#!/bin/bash
# Fa partire IDLE SYNC automaticamente all'accesso al Mac (LaunchAgent).
# Uso: ./install-autostart.sh        per installare
#      ./install-autostart.sh remove per rimuovere
set -euo pipefail

LABEL="com.idle-sync.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"

if [[ "${1:-}" == "remove" ]]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Avvio automatico rimosso."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>$DIR/server.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/.data/server.log</string>
  <key>StandardErrorPath</key><string>$DIR/.data/server.log</string>
</dict>
</plist>
PLIST

mkdir -p "$DIR/.data"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "✅ IDLE SYNC partirà da solo a ogni accesso. Log: $DIR/.data/server.log"
echo "   Il link per l'iPhone è scritto nel log."
