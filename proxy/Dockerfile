FROM node:20-alpine
WORKDIR /app
COPY . .
# 禁止 puppeteer 下载 Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --omit=dev
CMD ["npx", "tsx", "src/server.ts"]