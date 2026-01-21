#!/bin/bash

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command being run
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check if this is a git commit command
if [[ "$COMMAND" == *"git commit"* ]]; then
  echo "⚠️  REMINDER: Please ensure you have run 'yarn lint' and fixed any issues before committing."
fi

exit 0
