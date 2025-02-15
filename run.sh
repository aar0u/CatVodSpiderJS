#!/bin/bash

npm run host &
pid1=$!

(cd proxy && npm start) &
pid2=$!

trap "kill $pid1 $pid2" SIGINT  # 捕获 Ctrl + C 信号并杀死进程

wait  # 等待进程
