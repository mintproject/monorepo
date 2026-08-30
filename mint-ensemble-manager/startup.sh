#!/bin/bash

redis-server --port 7379 --daemonize yes
npm run build
npm start
