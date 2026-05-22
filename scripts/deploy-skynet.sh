#!/bin/sh
# Deploy the knx-yaml-to-ui add-on to Skynet HA.
#
# Runs INSIDE the HA "SSH & Web Terminal" add-on (Alpine + docker CLI + ha CLI).
# Handles three quirks that bit us during P1:
#   1. `addon/shared/` is gitignored locally → top-level shared/ must be copied in.
#   2. HA Supervisor caches the addon manifest version → restart/rebuild keeps the
#      old image tag. We build manually with `docker build` to get full output,
#      then re-tag the new image with whatever tag Supervisor currently expects
#      so `ha addons restart` picks it up.
#   3. /tmp is wiped on Supervisor restart → always clone fresh into /tmp.
#
# Usage:
#   sh deploy-skynet.sh [BRANCH]          # default: feature/plan-03-frontend-mvp
#
# Idempotent. Safe to re-run after every commit.

set -eu

REPO_URL="https://github.com/maurice198444/knx-yaml-to-ui.git"
BRANCH="${1:-feature/plan-03-frontend-mvp}"
ADDON_SLUG="local_knx_yaml_to_ui"
ADDON_DIR="/addons/${ADDON_SLUG}"
TMP_DIR="/tmp/knx-fresh"
IMAGE_BASE="local/amd64-addon-knx_yaml_to_ui"
BUILD_FROM="ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.20"
BUILD_ARCH="amd64"

log() { printf '\n[deploy-skynet] %s\n' "$*"; }
die() { printf '\n[deploy-skynet] ERROR: %s\n' "$*" >&2; exit 1; }

# 1. Fresh clone (always — /tmp can be wiped between sessions).
log "Cloning ${BRANCH} into ${TMP_DIR}"
rm -rf "$TMP_DIR"
git clone --quiet --branch "$BRANCH" "$REPO_URL" "$TMP_DIR" \
  || die "git clone failed for branch ${BRANCH}"

# 2. Read intended version from config.yaml.
NEW_VERSION="$(grep -E '^version:' "${TMP_DIR}/addon/config.yaml" | sed -E 's/version:[[:space:]]*"?([^"]+)"?/\1/')"
[ -n "$NEW_VERSION" ] || die "could not read version from config.yaml"
log "Intended version: ${NEW_VERSION}"

# 3. Sync addon source to /addons (overwrite-friendly).
log "Syncing addon source to ${ADDON_DIR}"
mkdir -p "$ADDON_DIR"
cp -rT "${TMP_DIR}/addon" "$ADDON_DIR"

# 4. Copy top-level shared/ in (it lives outside addon/ in the repo but the
#    Dockerfile expects it at the addon-build-context root).
log "Copying shared/ into addon build context"
cp -r "${TMP_DIR}/shared" "${ADDON_DIR}/shared"

# 5. Detect the tag Supervisor currently uses for this addon.
SUPERVISOR_VERSION="$(ha addons info "$ADDON_SLUG" 2>/dev/null | grep -E '^version:' | head -1 | awk '{print $2}')"
[ -n "$SUPERVISOR_VERSION" ] || SUPERVISOR_VERSION="$NEW_VERSION"
log "Supervisor expects image tag: ${SUPERVISOR_VERSION}"

# 6. Manual docker build with the INTENDED version tag.
log "Building image ${IMAGE_BASE}:${NEW_VERSION}"
cd "$ADDON_DIR"
docker build \
  --build-arg "BUILD_FROM=${BUILD_FROM}" \
  --build-arg "BUILD_ARCH=${BUILD_ARCH}" \
  --build-arg "BUILD_VERSION=${NEW_VERSION}" \
  -t "${IMAGE_BASE}:${NEW_VERSION}" \
  . || die "docker build failed — see output above"

# 7. Re-tag so Supervisor finds the new content under the tag it expects.
if [ "$NEW_VERSION" != "$SUPERVISOR_VERSION" ]; then
  log "Re-tagging as ${IMAGE_BASE}:${SUPERVISOR_VERSION} (Supervisor cache workaround)"
  docker tag "${IMAGE_BASE}:${NEW_VERSION}" "${IMAGE_BASE}:${SUPERVISOR_VERSION}"
fi

# 8. Restart addon → picks up new image content.
log "Restarting addon"
ha addons restart "$ADDON_SLUG" || die "ha addons restart failed"

# 9. Smoke checks.
sleep 3
log "Container status:"
docker ps --filter "name=addon_${ADDON_SLUG}" --format "table {{.Image}}\t{{.Status}}"

log "/app/web/ contents (should list index.html + assets/):"
docker exec "addon_${ADDON_SLUG}" ls /app/web/ 2>&1 || die "/app/web/ missing — build did not include frontend"

log "Recent backend log lines:"
ha addons logs "$ADDON_SLUG" 2>&1 | tail -10

log "DONE. Open the KNX YAML panel in HA, Ctrl+F5 to bust browser cache."
