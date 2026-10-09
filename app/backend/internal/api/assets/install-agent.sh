#!/usr/bin/env bash
# Containr node agent installer.
#   curl -fsSL <api>/api/agents/install.sh | bash -s -- --url <api> --token <enroll-token>
#
# One-shot: downloads the agent binary from the Containr instance (or GH
# releases as fallback), writes a systemd unit, starts it. SSH is never
# needed again — the agent heartbeats and polls commands outbound.
set -euo pipefail

API_URL=""
TOKEN=""
AGENT_NAME=""
VERSION=""

while [ $# -gt 0 ]; do
  case "$1" in
    --url) API_URL="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --name) AGENT_NAME="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

[ -n "$API_URL" ] || { echo "--url is required" >&2; exit 2; }
[ -n "$TOKEN" ] || { echo "--token is required (create one: containr nodes tokens create)" >&2; exit 2; }
API_URL="${API_URL%/}"
API_URL="${API_URL%/api/v1}"
API_URL="${API_URL%/api}"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; }

[ "$(id -u)" = "0" ] || { err "run as root (sudo bash -s -- --url … --token …)"; exit 1; }
command -v docker >/dev/null 2>&1 || { err "docker not found"; exit 1; }
command -v curl >/dev/null 2>&1 || { err "curl not found"; exit 1; }

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) err "unsupported architecture: $ARCH"; exit 1 ;;
esac

BIN=/usr/local/bin/containr-agent
info "downloading containr-agent (linux/$ARCH)"
if ! curl -fsSL "$API_URL/api/agents/download/linux-$ARCH" -o "$BIN" 2>/dev/null; then
  info "instance has no bundled binary — trying GitHub releases"
  REF="${VERSION:-latest}"
  if [ "$REF" = "latest" ]; then
    DL="https://github.com/Dvorinka/Containr/releases/latest/download/containr-agent-linux-$ARCH"
  else
    DL="https://github.com/Dvorinka/Containr/releases/download/$REF/containr-agent-linux-$ARCH"
  fi
  curl -fsSL "$DL" -o "$BIN" || { err "agent download failed"; exit 1; }
fi
chmod +x "$BIN"

UNIT=/etc/systemd/system/containr-agent.service
info "writing systemd unit"
cat > "$UNIT" <<UNIT
[Unit]
Description=Containr node agent
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Environment=CONTAINR_API_URL=$API_URL
Environment=CONTAINR_AGENT_AUTH_TOKEN=$TOKEN
Environment=CONTAINR_AGENT_NAME=${AGENT_NAME:-$(hostname)}
Restart=always
RestartSec=5
ExecStart=$BIN

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now containr-agent
info "agent installed and started — it should appear in Containr within ~15s"
