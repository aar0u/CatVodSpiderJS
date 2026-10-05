#!/usr/bin/env bash
set -euo pipefail

# Update CatVodSpiderJS on remote server via git pull
HOST="${1:-${DEPLOY_HOST:-mc}}"
APP_DIR="${DEPLOY_DIR:-/home/azureuser/apps/catvodspiderjs}"

echo "==> 1. 停止当前运行的 catvod-proxy 服务..."
ssh "$HOST" "docker exec browser-box supervisorctl stop catvod-proxy || true"

echo "==> 2. 在远端执行 git fetch + reset (浅拉取) 更新 CatVodSpiderJS 代码 ..."
ssh "$HOST" "cd '$APP_DIR' && git fetch --depth 1 origin main && git reset --hard origin/main"

echo "==> 3. 检查依赖并在容器内安装 ..."
ssh "$HOST" "docker exec -u 1000:1000 -w /apps/catvodspiderjs/proxy browser-box npm install"

echo "==> 4. 更新配置并启动 catvod-proxy 服务..."
ssh "$HOST" "docker exec browser-box sh -c '
  supervisorctl update
  if ! supervisorctl status catvod-proxy | grep -qE \"RUNNING|STARTING\"; then
    supervisorctl start catvod-proxy
  fi
'"

echo "==> 5. 服务状态确认:"
sleep 1.5
ssh "$HOST" "docker exec browser-box supervisorctl status catvod-proxy"

echo "==> 更新完成！"
