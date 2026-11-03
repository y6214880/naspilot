#!/usr/bin/env bash
# 部署构建：纯 Node 服务无编译产物，这里做入口语法自检
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

node --check server/index.js