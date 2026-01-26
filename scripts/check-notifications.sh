#!/usr/bin/env bash
# Check notifications from the production API

USER=$(pass show colonelpanic-org-agenda.fly.dev | grep '^user:' | cut -d' ' -f2)
PASS=$(pass show colonelpanic-org-agenda.fly.dev | head -1)

curl -s -u "$USER:$PASS" \
  https://colonelpanic-org-agenda.fly.dev/notifications | jq "${1:-.}"
