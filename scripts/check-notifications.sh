#!/usr/bin/env bash
# Check notifications from the production API

USER=imalison
PASS=$(pass show org-agenda-api-imalison | head -1)

curl -s -u "$USER:$PASS" \
  https://org-agenda-api.rocket-sense.duckdns.org/notifications | jq "${1:-.}"
