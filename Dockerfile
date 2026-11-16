# Bước 1: build giao diện cho bản VPS
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN VITE_SERVER=1 npx vite build

# Bước 2: biên dịch whisper.cpp để chép lời ý tưởng ngay trên VPS (miễn phí, chạy CPU)
FROM node:22-alpine AS whisper
RUN apk add --no-cache git cmake make g++ linux-headers
ARG WHISPER_VERSION=v1.9.5
RUN git clone --depth 1 --branch ${WHISPER_VERSION} https://github.com/ggml-org/whisper.cpp /w \
 && cmake -S /w -B /w/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF -DGGML_NATIVE=ON \
 && cmake --build /w/build -j"$(nproc)" --target whisper-cli \
 && cp /w/build/bin/whisper-cli /usr/local/bin/whisper-cli

# Bước 3: máy chủ chạy app (không cần thư viện npm ngoài)
FROM node:22-alpine
RUN apk add --no-cache ffmpeg libstdc++ libgomp
COPY --from=whisper /usr/local/bin/whisper-cli /usr/local/bin/whisper-cli
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data STATIC_DIR=/app/dist NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.mjs"]
