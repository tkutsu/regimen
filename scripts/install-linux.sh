#!/usr/bin/env bash
# Builds the desktop app and installs it for the current user: the binary in
# ~/.local/bin and a launcher entry. Re-run it to update.
#
#   scripts/install-linux.sh [icon]
#
# `icon` is an icon name from your theme (e.g. emoji-food); without one, the
# app's own icon is installed and used.
set -euo pipefail
cd "$(dirname "$0")/.."

icon=${1:-regimen}
bin=~/.local/bin/regimen
data=${XDG_DATA_HOME:-~/.local/share}

pnpm tauri build --no-bundle
install -Dm755 src-tauri/target/release/regimen "$bin"
install -Dm644 src-tauri/icons/128x128@2x.png "$data/icons/hicolor/256x256/apps/regimen.png"

install -Dm644 /dev/stdin "$data/applications/regimen.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Regimen
Comment=Calorie and weigh-in tracker
Exec=$bin
Icon=$icon
Categories=Utility;
Keywords=calories;food;weight;diet;
StartupWMClass=regimen
EOF

echo "Installed $bin and the Regimen launcher entry."
