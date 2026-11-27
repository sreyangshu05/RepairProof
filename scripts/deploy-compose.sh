#!/usr/bin/env bash
set -Eeuo pipefail

image_tag="${1:?Usage: deploy-compose.sh <40-character-commit-sha>}"
[[ "$image_tag" =~ ^[a-f0-9]{40}$ ]] || { echo "Image tag must be a full lowercase commit SHA" >&2; exit 2; }
mode="${2:-normal}"
[[ "$mode" == normal || "$mode" == --skip-migrations ]] || { echo "Unknown deployment mode: $mode" >&2; exit 2; }

: "${IMAGE_PREFIX:?Set IMAGE_PREFIX to the GHCR image prefix}"
: "${DEPLOY_DIR:?Set DEPLOY_DIR to the environment deployment directory}"
: "${STACK_NAME:?Set STACK_NAME to an isolated Compose project name}"
release_dir="$(cd "$(dirname "$0")" && pwd)"
env_file="$DEPLOY_DIR/.env.production"
compose_file="$release_dir/docker-compose.prod.yml"
state_file="$DEPLOY_DIR/.deploy-current"
history_file="$DEPLOY_DIR/.deploy-history"

[[ -f "$env_file" ]] || { echo "Missing runtime environment file: $env_file" >&2; exit 2; }
[[ -f "$compose_file" ]] || { echo "Missing production Compose file: $compose_file" >&2; exit 2; }
chmod 600 "$env_file"

previous_tag=""
if [[ -f "$state_file" ]]; then
  previous_tag="$(tr -d '\r\n' < "$state_file")"
  [[ "$previous_tag" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid prior release marker; inspect $state_file" >&2; exit 2; }
fi

export IMAGE_PREFIX IMAGE_TAG="$image_tag"
compose() {
  docker compose --project-directory "$release_dir" --env-file "$env_file" -p "$STACK_NAME" -f "$compose_file" "$@"
}

if [[ "$mode" == "--skip-migrations" ]]; then
  [[ -f "$history_file" ]] && grep -Fxq "$image_tag" "$history_file" || { echo "Rollback target was not recorded as a successful release" >&2; exit 2; }
  [[ -n "$previous_tag" && "$previous_tag" != "$image_tag" ]] || { echo "Rollback target must differ from the current release" >&2; exit 2; }
  echo "Restoring previously deployed application image $image_tag without changing the database schema"
  compose pull api web
  compose up --detach --no-build --no-deps --wait --wait-timeout 180 api web
  printf '%s\n' "$image_tag" > "$state_file.new"
  mv "$state_file.new" "$state_file"
  echo "Application rollback healthy: $image_tag (database migrations were not rolled back)"
  exit 0
fi

echo "Pulling immutable images for $image_tag"
compose pull migrate api web
echo "Waiting for data services and applying forward-only migrations"
compose up --detach --wait --wait-timeout 600 postgres redis clamav
compose run --rm migrate

echo "Starting API and frontend and waiting for health checks"
if compose up --detach --no-build --no-deps --wait --wait-timeout 180 api web; then
  printf '%s\n' "$image_tag" > "$state_file.new"
  mv "$state_file.new" "$state_file"
  grep -Fxq "$image_tag" "$history_file" 2>/dev/null || printf '%s\n' "$image_tag" >> "$history_file"
  echo "Deployment healthy: $image_tag"
  exit 0
fi

echo "Deployment health check failed" >&2
if [[ -n "$previous_tag" ]]; then
  echo "Restoring application images from $previous_tag; database migrations remain applied" >&2
  export IMAGE_TAG="$previous_tag"
  compose pull api web
  compose up --detach --no-build --no-deps --wait --wait-timeout 180 api web
  echo "Application rollback completed. Investigate the failed release and database migration compatibility." >&2
else
  compose stop api web || true
  echo "No prior release is recorded; stop and recover the application manually." >&2
fi
exit 1
