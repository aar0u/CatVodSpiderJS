## 注意：需要在项目根目录执行 docker build，才能访问上级目录内容
## proxy folder: docker build -f Dockerfile ..
## . folder: docker build -f proxy/Dockerfile .
FROM node:20-alpine
WORKDIR /app/proxy
COPY ./proxy .
COPY ./json /app/json
COPY ./js /app/js
COPY ./lib /app/lib
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --omit=dev
CMD ["npx", "tsx", "src/server.ts"]
