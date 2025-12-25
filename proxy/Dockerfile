# Note: docker build must be executed from the project root to access parent directory contents
# run from proxy folder: docker build -f Dockerfile ..
# run from . folder: docker build -f proxy/Dockerfile .

FROM node:20-slim
WORKDIR /app/proxy

ARG TARGETARCH

# Dependencies
RUN echo ${TARGETARCH} && \
    apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    fluxbox \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Static files and library assets
COPY ./json /app/json
COPY ./js /app/js
COPY ./lib /app/lib

RUN npm install -g pnpm

# Code directory, for volume mount -v $(pwd)/src:/app/proxy/src
COPY ./proxy .
RUN pnpm install

RUN npx playwright install --with-deps chromium

RUN mkdir -p /app/.vnc && \
    chmod 755 /app/.vnc

# VNC
ENV DISPLAY=:99

CMD Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render > /tmp/xvfb.log 2>&1 & \
    sleep 1 && \
    # Window manager
    fluxbox >/dev/null 2>&1 & \
    # VNC service
    x11vnc -display :99 -forever -shared -nopw -rfbport 5900 > /tmp/x11vnc.log 2>&1 & \
    # Web interface
    /usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 8445 > /tmp/novnc.log 2>&1 & \
    # App crawler proxy
    PORT=8787 HEADLESS=true BROWSER_TIMEOUT=1200 PAGE_TIMEOUT=120 PAGE_CLOSE_DELAY=2 pnpm run dev
