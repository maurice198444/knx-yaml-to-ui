ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20
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

COPY rootfs /

EXPOSE 8099

LABEL \
    io.hass.name="knx-yaml-to-ui" \
    io.hass.version=$BUILD_VERSION \
    io.hass.type="addon" \
    io.hass.arch=$BUILD_ARCH
