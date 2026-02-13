#!/bin/bash
# ================================================
# AGENTIS — Cleanup Backup Files
# FIX #25 (Feb 13, 2026)
#
# Removes .backup, .OLD, and other leftover files
# that clutter the codebase.
#
# Usage:
#   cd ~/Documents/Repositories/legal-council
#   bash scripts/cleanup-backups.sh
#
# Use --dry-run to preview without deleting:
#   bash scripts/cleanup-backups.sh --dry-run
# ================================================

set -e

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "🔍 DRY RUN — showing files that would be deleted:"
  echo ""
fi

# Find all backup/old files
FILES=$(find . -type f \( \
  -name "*.backup" \
  -o -name "*.backup2" \
  -o -name "*.backup3" \
  -o -name "*.backup-format" \
  -o -name "*.backup-json" \
  -o -name "*.OLD.js" \
  -o -name "*.OLD.ts" \
  -o -name "route.backup.ts" \
\) -not -path "./node_modules/*" -not -path "./.git/*")

if [ -z "$FILES" ]; then
  echo "✅ No backup files found — project is clean!"
  exit 0
fi

COUNT=$(echo "$FILES" | wc -l)
echo "Found $COUNT backup file(s):"
echo ""

echo "$FILES" | while read -r file; do
  SIZE=$(du -h "$file" | cut -f1)
  if [ "$DRY_RUN" = true ]; then
    echo "  📄 $file ($SIZE)"
  else
    echo "  🗑️  Deleting: $file ($SIZE)"
    rm "$file"
  fi
done

echo ""

if [ "$DRY_RUN" = true ]; then
  echo "Run without --dry-run to actually delete these files."
else
  echo "✅ Cleanup complete! Deleted $COUNT backup file(s)."
  echo "   Don't forget to commit: git add -A && git commit -m 'chore: remove backup files'"
fi
