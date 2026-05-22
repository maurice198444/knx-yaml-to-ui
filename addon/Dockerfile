ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20

# -------- Stage 1: build the frontend (Vite + Lit) --------
FROM node:20-alpine AS web-builder
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /web
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm build

# -------- Stage 2: runtime image (HA add-on base) --------
FROM $BUILD_FROM

ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_VERSION

ENV LANG=C.UTF-8 PYTHONUNBUFFERED=1

WORKDIR /app

COPY shared /shared
COPY app /app/app

RUN pip install --no-cache-dir \
        /shared \
        /app/app

# Frontend build output → served by FastAPI StaticFiles + SPA fallback.
COPY --from=web-builder /web/dist /app/web

COPY rootfs /

EXPOSE 8099

LABEL \
    io.hass.name="knx-yaml-to-ui" \
    io.hass.version=$BUILD_VERSION \
    io.hass.type="addon" \
    io.hass.arch=$BUILD_ARCH
