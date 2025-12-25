#!/bin/bash

CONTAINER_NAME=spider-proxy

docker rm -f $CONTAINER_NAME 2>/dev/null
docker run -d --pull=always --name $CONTAINER_NAME --restart=unless-stopped \
--network my_internal_net -p 8445:8445 \
-v $(pwd)/src:/app/proxy/src \
ghcr.io/aar0u/catvodspiderjs-proxy:latest \
bash -c "Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render > /tmp/xvfb.log 2>&1 & \
    sleep 1 && \
    fluxbox >/dev/null 2>&1 & \
    x11vnc -display :99 -forever -shared -nopw -rfbport 5900 > /tmp/x11vnc.log 2>&1 & \
    /usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 8445 > /tmp/novnc.log 2>&1 & \
    PORT=8787 HEADLESS=false BROWSER_TIMEOUT=1200 PAGE_TIMEOUT=120 PAGE_CLOSE_DELAY=2 pnpm run dev"

docker logs -f $CONTAINER_NAME
