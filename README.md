# CatVodSpiderJS

本仓库当前主力只支持 **OK影视 / FongMi / 影视仓 / TVBox 兼容配置**。

已移除旧的 CatVodOpen NodeJS 打包链路。原 `nodejs/dist/index.js.md5` 方案只服务于已基本停滞的 CatVodOpen/CatPawOpen 生态，不再维护。

## 当前主链路

```text
OK影视 / FongMi / 影视仓
  -> 加载 proxy 输出的 TVBox 配置
  -> /js/*.js Spider
  -> 必要时通过 proxy /url 使用 Playwright 解析播放地址
```

重点目录：

- `js/`：站点 Spider，例如 `js/9anime.js`。
- `lib/`：Spider 公共工具和数据结构。
- `wrapper/`：本地测试时模拟 CatVod JS 环境。
- `scripts/test-spider.mjs`：本地测试入口。
- `proxy/`：OKTV 配置服务、静态文件服务、浏览器解析服务。
- `proxy/src/config/sites.json`：注入到配置里的本地 JS 站点列表。

## 本地测试 Spider

```bash
node scripts/test-spider.mjs
```

当前测试用例在 `scripts/test-spider.mjs` 内配置。

## 项目结构说明

根目录不再作为 npm 管理单元，不再需要在根目录执行 `npm install`。

- 根目录：业务脚本与测试脚本（如 `scripts/test-spider.mjs`、`scripts/build-config.mjs`）直接使用仓库内本地模块。
- 依赖环境：仅 `proxy/` 仍有独立的 `package.json`，需要依赖时只在该目录下安装。

## 启动 proxy

```bash
cd proxy
npm install
npm start
```

默认端口：`8787`。

OK影视 / FongMi / 影视仓里使用配置地址：

```text
http://<host>:8787/
```

`proxy` 会：

1. 聚合远程配置；
2. 把 `proxy/src/config/sites.json` 里的本地 JS 源放到前面；
3. 提供 `/js/*`、`/lib/*`、`/json/*` 静态文件；
4. 提供 `/url?url=...&click=...` 浏览器解析接口。

## 生成 TVBox 配置

仓库保留一个轻量 `scripts/build-config.mjs`，只生成 TVBox/OKTV 兼容配置：

```bash
node scripts/build-config.mjs
```

输出：

```text
tv_config.json
```

注意：当前推荐使用 `proxy/` 动态输出配置；`scripts/build-config.mjs` 仅用于旧式静态配置生成。

## 已废弃

- CatVodOpen `dist/index.js.md5` NodeJS 打包方案。
- `json/CatOpen.json` / `open_config.json`。
- `nodejs/` Fastify 打包服务。
