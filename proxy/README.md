# CatVodSpiderJS Proxy

1. Aggregate and filter CatVod configurations from multiple sources.
2. Automatically parse video streams and subtitles using Headless Browser.

## Usage

Build image:

```sh
docker build -t catvodspiderjs-proxy .
```

Run container:

```sh
docker run -p 8080:80 catvodspiderjs-proxy
```

From GHCR:

```sh
docker run -d --name spider-proxy --restart=always -p 8080:80 ghcr.io/aar0u/catvodspiderjs-proxy:latest
```
