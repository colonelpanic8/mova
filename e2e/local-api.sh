#!/usr/bin/env bash
# Script to build and run the org-agenda-api container locally for E2E testing
#
# Usage:
#   ./e2e/local-api.sh start        - Start with test data (default for E2E)
#   ./e2e/local-api.sh start --prod - Start with production data (clones real repo)
#   ./e2e/local-api.sh stop         - Stop the container
#   ./e2e/local-api.sh status       - Check if container is running
#   ./e2e/local-api.sh logs         - Show container logs
#
# Test mode (default):
#   Uses local test data from e2e/test-data/ with credentials: testuser/testpass
#
# Production mode (--prod):
#   Clones from real git repo using decrypted secrets

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

CONTAINER_NAME="mova-test-api"
LOCAL_PORT="${MOVA_LOCAL_API_PORT:-8080}"
ORG_AGENDA_API_DIR="${ORG_AGENDA_API_DIR:-$HOME/Projects/colonelpanic-org-agenda-api}"

# Test credentials
TEST_USER="testuser"
TEST_PASSWORD="testpass"

log_info() {
  echo "[local-api] $*"
}

log_error() {
  echo "[local-api] ERROR: $*" >&2
}

decrypt_secret() {
  local secret_file="$1"
  local identity=""

  for key_type in ed25519 rsa; do
    if [[ -f "$HOME/.ssh/id_${key_type}" ]]; then
      identity="$HOME/.ssh/id_${key_type}"
      break
    fi
  done

  if [[ -z "$identity" ]]; then
    log_error "No SSH identity found for decryption"
    return 1
  fi

  # Try age directly, or use nix run to get it (cleaner than nix-shell)
  if command -v age &> /dev/null; then
    age -d -i "$identity" "$secret_file"
  else
    nix run nixpkgs#age -- -d -i "$identity" "$secret_file" 2>/dev/null
  fi
}

build_container() {
  if [[ ! -d "$ORG_AGENDA_API_DIR" ]]; then
    log_error "org-agenda-api directory not found: $ORG_AGENDA_API_DIR"
    return 1
  fi

  log_info "Building container from $ORG_AGENDA_API_DIR..." >&2

  local container_result
  local load_output
  local image_name

  # Check if we're building from a nix store path (read-only)
  if [[ "$ORG_AGENDA_API_DIR" == /nix/store/* ]]; then
    log_info "Building from nix store path via github flake..." >&2
    # Build from github since we can't build from nix store
    container_result=$(mktemp -d)/result-container
    nix build "github:colonelpanic8/org-agenda-api#container" -o "$container_result"

    log_info "Loading container into Docker..." >&2
    load_output=$(docker load < "$container_result" 2>&1)
    image_name=$(echo "$load_output" | grep -oP 'Loaded image: \K\S+')
    rm -rf "$(dirname "$container_result")"
  else
    pushd "$ORG_AGENDA_API_DIR" > /dev/null
    nix build .#container -o result-container

    log_info "Loading container into Docker..." >&2

    # Get the loaded image name - capture output separately
    load_output=$(docker load < result-container 2>&1)
    image_name=$(echo "$load_output" | grep -oP 'Loaded image: \K.*')

    popd > /dev/null
  fi

  # Return just the image name to stdout
  echo "$image_name"
}

start_test_container() {
  log_info "Starting container in TEST mode..."
  log_info "Using test data from $SCRIPT_DIR/test-data"
  log_info "Credentials: $TEST_USER / $TEST_PASSWORD"

  # Check if already running
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_info "Container already running"
    return 0
  fi

  # Remove existing stopped container
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

  # Build and get image name
  IMAGE_NAME=$(build_container)

  if [[ -z "$IMAGE_NAME" ]]; then
    log_error "Failed to build container"
    return 1
  fi

  log_info "Using image: $IMAGE_NAME"

  # Create a writable copy of test data for capture to work
  TEST_DATA_COPY=$(mktemp -d)
  cp -r "$SCRIPT_DIR/test-data/"* "$TEST_DATA_COPY/"
  # Initialize git in the copy if not already
  if [[ ! -d "$TEST_DATA_COPY/.git" ]]; then
    git -C "$TEST_DATA_COPY" init
    git -C "$TEST_DATA_COPY" config user.email "test@test.local"
    git -C "$TEST_DATA_COPY" config user.name "Test User"
    git -C "$TEST_DATA_COPY" add .
    git -C "$TEST_DATA_COPY" commit -m "Initial test data"
  fi

  # Create inbox.org if it doesn't exist
  if [[ ! -f "$TEST_DATA_COPY/inbox.org" ]]; then
    echo -e "#+TITLE: Inbox\n\n* Tasks\n" > "$TEST_DATA_COPY/inbox.org"
    git -C "$TEST_DATA_COPY" add inbox.org
    git -C "$TEST_DATA_COPY" commit -m "Add inbox.org"
  fi

  # Read custom elisp config
  CUSTOM_ELISP=""
  if [[ -f "$SCRIPT_DIR/test-config.el" ]]; then
    CUSTOM_ELISP=$(cat "$SCRIPT_DIR/test-config.el")
    log_info "Including custom elisp config for org-agenda-files"
  fi

  # Create env file with test credentials
  ENV_FILE=$(mktemp)

  cat > "$ENV_FILE" << EOF
AUTH_USER=$TEST_USER
AUTH_PASSWORD=$TEST_PASSWORD
GIT_USER_EMAIL=test@test.local
GIT_USER_NAME=Test User
EOF

  log_info "Starting container on port $LOCAL_PORT..."

  # Build docker run args
  DOCKER_ARGS=(
    -d
    --name "$CONTAINER_NAME"
    -p "${LOCAL_PORT}:80"
    --env-file "$ENV_FILE"
    -v "$TEST_DATA_COPY:/data/org"
  )

  # Add elisp config if available
  if [[ -n "$CUSTOM_ELISP" ]]; then
    DOCKER_ARGS+=(-e "ORG_API_CUSTOM_ELISP_CONTENT=$CUSTOM_ELISP")
  fi

  docker run "${DOCKER_ARGS[@]}" "$IMAGE_NAME"

  rm -f "$ENV_FILE" 2>/dev/null || true

  # Store the temp dir path for cleanup
  echo "$TEST_DATA_COPY" > "/tmp/${CONTAINER_NAME}-data-dir"

  log_info "Container started. Waiting for API to be ready..."

  # Wait for the API to be ready (test mode should be faster - no git clone)
  for i in {1..60}; do
    if curl -s -o /dev/null -w '%{http_code}' "http://localhost:${LOCAL_PORT}" | grep -q "401\|200"; then
      log_info "API is ready at http://localhost:${LOCAL_PORT}"
      return 0
    fi
    sleep 1
  done

  log_error "API did not become ready in time"
  docker logs "$CONTAINER_NAME"
  return 1
}

start_prod_container() {
  log_info "Starting container in PRODUCTION mode..."

  # Check if already running
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_info "Container already running"
    return 0
  fi

  # Remove existing stopped container
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

  # Build and get image name
  IMAGE_NAME=$(build_container)

  if [[ -z "$IMAGE_NAME" ]]; then
    log_error "Failed to build container"
    return 1
  fi

  log_info "Using image: $IMAGE_NAME"

  # Decrypt secrets
  log_info "Decrypting secrets..."
  GIT_SSH_KEY=$(decrypt_secret "$ORG_AGENDA_API_DIR/secrets/git-ssh-key.age")
  AUTH_PASSWORD=$(decrypt_secret "$ORG_AGENDA_API_DIR/secrets/auth-password.age")

  # Read custom elisp if it exists
  CUSTOM_ELISP=""
  if [[ -f "$ORG_AGENDA_API_DIR/custom-config.el" ]]; then
    CUSTOM_ELISP=$(cat "$ORG_AGENDA_API_DIR/custom-config.el")
    log_info "Including custom elisp config"
  fi

  # Create env file
  ENV_FILE=$(mktemp)

  cat > "$ENV_FILE" << EOF
GIT_SYNC_REPOSITORY=git@github.com:colonelpanic8/org.git
AUTH_USER=imalison
AUTH_PASSWORD=$AUTH_PASSWORD
GIT_USER_EMAIL=org-agenda-api@colonelpanic.io
GIT_USER_NAME=org-agenda-api
EOF

  # Write the SSH key to a persistent file for mounting
  SSH_KEY_FILE="/tmp/${CONTAINER_NAME}-ssh-key"
  echo "$GIT_SSH_KEY" > "$SSH_KEY_FILE"
  chmod 600 "$SSH_KEY_FILE"

  log_info "Starting container on port $LOCAL_PORT..."

  # Build docker run command
  DOCKER_ARGS=(
    -d
    --name "$CONTAINER_NAME"
    -p "${LOCAL_PORT}:80"
    --env-file "$ENV_FILE"
    -v "$SSH_KEY_FILE:/secrets/ssh_key:ro"
  )

  # Add elisp config if available
  if [[ -n "$CUSTOM_ELISP" ]]; then
    DOCKER_ARGS+=(
      -e "ORG_API_CUSTOM_ELISP_CONTENT=$CUSTOM_ELISP"
    )
  fi

  docker run "${DOCKER_ARGS[@]}" "$IMAGE_NAME"

  rm -f "$ENV_FILE" 2>/dev/null || true

  log_info "Container started. Waiting for API to be ready..."

  # Wait for the API to be ready (up to 90 seconds - git clone can take a while)
  for i in {1..90}; do
    if curl -s -o /dev/null -w '%{http_code}' "http://localhost:${LOCAL_PORT}" | grep -q "401\|200"; then
      log_info "API is ready at http://localhost:${LOCAL_PORT}"
      return 0
    fi
    sleep 1
  done

  log_error "API did not become ready in time"
  docker logs "$CONTAINER_NAME"
  rm -f "$SSH_KEY_FILE" 2>/dev/null || true
  return 1
}

stop_container() {
  log_info "Stopping container..."
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  # Clean up any SSH key file from prod mode
  rm -f "/tmp/${CONTAINER_NAME}-ssh-key" 2>/dev/null || true
  # Clean up test data copy from test mode
  if [[ -f "/tmp/${CONTAINER_NAME}-data-dir" ]]; then
    local data_dir
    data_dir=$(cat "/tmp/${CONTAINER_NAME}-data-dir")
    if [[ -d "$data_dir" ]]; then
      rm -rf "$data_dir"
      log_info "Cleaned up test data directory: $data_dir"
    fi
    rm -f "/tmp/${CONTAINER_NAME}-data-dir"
  fi
  log_info "Container stopped"
}

show_status() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "running"
    echo "URL: http://localhost:${LOCAL_PORT}"
  else
    echo "stopped"
  fi
}

show_logs() {
  docker logs "$CONTAINER_NAME" "$@"
}

case "${1:-help}" in
  start)
    if [[ "${2:-}" == "--prod" ]]; then
      start_prod_container
    else
      start_test_container
    fi
    ;;
  stop)
    stop_container
    ;;
  status)
    show_status
    ;;
  logs)
    shift
    show_logs "$@"
    ;;
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    echo ""
    echo "Commands:"
    echo "  start        - Start with test data (default for E2E testing)"
    echo "  start --prod - Start with production data (clones real git repo)"
    echo "  stop         - Stop the container"
    echo "  status       - Check if container is running"
    echo "  logs         - Show container logs"
    echo ""
    echo "Test mode credentials: $TEST_USER / $TEST_PASSWORD"
    echo ""
    echo "Environment variables:"
    echo "  MOVA_LOCAL_API_PORT - Port to expose API on (default: 8080)"
    echo "  ORG_AGENDA_API_DIR  - Path to org-agenda-api project"
    exit 1
    ;;
esac
