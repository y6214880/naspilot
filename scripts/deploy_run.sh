#!/usr/bin/env bash
# 部署启动：固定监听 5000 端口，运行 NasPilot HTTP 服务
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

export PORT=5000
exec node server/index.js