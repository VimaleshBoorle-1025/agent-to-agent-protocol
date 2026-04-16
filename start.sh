#!/bin/sh
# Selects the right service to start based on SERVICE env var.
# Maps Railway's PORT to the service-specific port env var.

SERVICE=${SERVICE:-registry-server}

case "$SERVICE" in
  registry-server)
    export REGISTRY_PORT=${PORT:-3001}
    exec node packages/registry-server/dist/index.js
    ;;
  mailbox-server)
    export MAILBOX_PORT=${PORT:-3002}
    exec node packages/mailbox-server/dist/index.js
    ;;
  audit-server)
    export AUDIT_PORT=${PORT:-3003}
    exec node packages/audit-server/dist/index.js
    ;;
  identity-service)
    export IDENTITY_PORT=${PORT:-3004}
    exec node packages/identity-service/dist/index.js
    ;;
  human-auth)
    export HUMAN_AUTH_PORT=${PORT:-3005}
    exec node packages/human-auth/dist/index.js
    ;;
  *)
    echo "Unknown SERVICE: $SERVICE"
    exit 1
    ;;
esac
