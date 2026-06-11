# CatVodSpiderJS Proxy

Proxy 是当前 OK影视 / FongMi / 影视仓 主链路的一部分。

功能：

1. 输出 TVBox/OKTV 兼容配置。
2. 聚合远程配置，并把 `src/config/sites.json` 里的本地 JS 源放到最前面。
3. 提供 `/js/*`、`/lib/*`、`/json/*` 静态文件，供客户端加载 Spider。
4. 通过 Playwright 提供 `/url` 浏览器解析能力，用于需要渲染、点击或嗅探的站点。

## Local

```sh
npm install
npm start
```

默认端口：`8787`。

配置地址：

```text
http://127.0.0.1:8787/
```

`js/9anime.js` 这类继承 `RemoteRenderSpider` 的源会自动请求同 origin 的 `/url`。

## Docker

Build image from repo root:

```sh
docker build -f proxy/Dockerfile -t catvodspiderjs-proxy .
```

Run:

```sh
docker run -d --name spider-proxy --restart=always -p 8787:8787 catvodspiderjs-proxy
```

GHCR:

```sh
docker run -d --name spider-proxy --restart=always -p 8787:8787 ghcr.io/aar0u/catvodspiderjs-proxy:latest
```

## Config files

- `src/config/cfg.json`：远程配置源列表。
- `src/config/sites.json`：本地 JS 站点列表，会注入到最终配置前面。
- `src/config/sub.json`：字幕相关配置。

## Legacy note

旧 CatVodOpen NodeJS `dist/index.js.md5` 发布链路已移除；本服务只面向 OKTV/FongMi/TVBox 兼容配置。
