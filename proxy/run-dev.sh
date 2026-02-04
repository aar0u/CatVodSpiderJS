#!/bin/bash

# 如果传入参数，则设置 HEADLESS=true，否则为 false
HEADLESS_MODE=false
if [ "$1" = "headless" ]; then
    HEADLESS_MODE=true
fi

PORT=8787 HEADLESS=$HEADLESS_MODE BROWSER_TIMEOUT=1200 PAGE_TIMEOUT=120 PAGE_CLOSE_DELAY=2 npm run dev
