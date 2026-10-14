#!/bin/sh
# Cross-build picd for Kindle devices (+ host build for development).
#   armhf  : ARMv7 hard-float  (Kindle 5.16.3+ firmware, e.g. PW4 5.17.x)
#   armv6  : ARMv6 soft-float  (older Kindles)
set -e
cd "$(dirname "$0")"
mkdir -p dist

echo "==> linux/armhf (GOARM=7)"
GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0 \
    go build -trimpath -ldflags="-s -w" -o dist/picd-armhf .

echo "==> linux/armv6 soft-float (GOARM=6)"
GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 \
    go build -trimpath -ldflags="-s -w" -o dist/picd-armv6 .

echo "==> host ($(go env GOOS)/$(go env GOARCH)) — for local development"
go build -trimpath -o "dist/picd-$(go env GOOS)-$(go env GOARCH)" .

echo "Done:"
ls -la dist/
