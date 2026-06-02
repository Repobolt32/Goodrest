#!/bin/bash
# Install project superpowers skill overrides to global Claude Code skills directory.
# Run once per machine to enable Ref MCP enforcement in brainstorming, writing-plans, systematic-debugging.

set -e

GLOBAL="$HOME/.claude/skills"
LOCAL="$(dirname "$0")/../.claude/skills"

if [ ! -d "$LOCAL/brainstorming" ]; then
  echo "ERROR: Local overrides not found at $LOCAL"
  echo "Run this from the project root: bash scripts/setup-skills.sh"
  exit 1
fi

for skill in brainstorming writing-plans systematic-debugging; do
  cp "$LOCAL/$skill/SKILL.md" "$GLOBAL/$skill/SKILL.md"
  echo "Installed: $skill → $GLOBAL/$skill/SKILL.md"
done

echo ""
echo "Done. Ref MCP enforcement active for: brainstorming, writing-plans, systematic-debugging."
