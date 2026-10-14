#!/bin/sh
# Name: Image Hub
# Author: kindle-image-hub
# Icon:

# Toggle the picd LAN image server.
#   tap once  -> start, show http://<ip>:8642
#   tap again -> stop
#
# Expected layout:
#   /mnt/us/documents/image-hub/picd-armhf
#   /mnt/us/documents/image-hub/picd-armv6
#   /mnt/us/documents/image_hub.sh   (this file)

BIN_DIR="/mnt/us/documents/image-hub"
PIDF="/tmp/picd.pid"
PORT=8642

# Pick the build matching the device's float ABI (same trick as gnomegames)
if [ -f /lib/ld-linux-armhf.so.3 ]; then
    BIN="$BIN_DIR/picd-armhf"
else
    BIN="$BIN_DIR/picd-armv6"
fi

if [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF" 2>/dev/null)" 2>/dev/null; then
    kill "$(cat "$PIDF")" 2>/dev/null
    rm -f "$PIDF"
    eips -d l=fff,w=1072,h=120
    eips 2 2 "Image Hub stopped."
    exit 0
fi

if [ ! -x "$BIN" ] && [ ! -f "$BIN" ]; then
    eips -d l=fff,w=1072,h=120
    eips 2 2 "ERROR: $BIN not found."
    exit 1
fi
chmod +x "$BIN" 2>/dev/null

eips -d l=fff,w=1072,h=120
eips 2 2 "Starting Image Hub..."
nohup "$BIN" -addr ":$PORT" >/tmp/picd.log 2>&1 &
echo $! > "$PIDF"

# Best-effort LAN IP for the on-screen hint
sleep 1
IP=$(ip -4 addr show wlan0 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1)
if [ -z "$IP" ]; then
    IP=$(ifconfig wlan0 2>/dev/null | awk '/inet addr:/ {print $2}' | cut -d: -f2)
fi
if [ -z "$IP" ]; then
    IP="<kindle-ip>"
fi

eips -d l=fff,w=1072,h=140
eips 2 2 "Image Hub running."
eips 2 3 "Open in browser:  http://$IP:$PORT"
eips 2 4 "Tap this item again to stop."

exit 0
