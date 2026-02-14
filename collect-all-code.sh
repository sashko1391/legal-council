#!/bin/bash

###############################################################################
# AGENTIS — COLLECT ALL CODE
# Feb 14, 2026 — simple version (zsh/bash compatible)
###############################################################################

DATE_SUFFIX=$(date '+%Y%m%d')
OUTPUT="COMPLETE_CODE_${DATE_SUFFIX}.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TMPLIST=$(mktemp)

cat > "$OUTPUT" << HEADER
═══════════════════════════════════════════════════════════════════════
  AGENTIS LEGAL COUNCIL — COMPLETE PROJECT CODE
═══════════════════════════════════════════════════════════════════════

Generated: $TIMESTAMP

Backend: 8 AI agents, 2 orchestrators, services, RAG
Frontend: Next.js 14, React, Zustand, Tailwind CSS
Law Base: 1,620 articles ЦКУ + КЗпП via Pinecone
LLM: Anthropic Claude, OpenAI GPT, Google Gemini

═══════════════════════════════════════════════════════════════════════
HEADER

add_file() {
    if [ ! -f "$1" ]; then return; fi
    echo "" >> "$OUTPUT"
    echo "════════════════════════════════════════════════════════════════" >> "$OUTPUT"
    echo "FILE: $1" >> "$OUTPUT"
    echo "════════════════════════════════════════════════════════════════" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    cat "$1" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    echo "  ✓ $1"
}

section() {
    echo ""
    echo "━━━ $1"
}

###############################################################################

section "Core Types"
add_file packages/core/orchestrator/types.ts

section "Backend Agents"
find packages/legal-council/agents -name '*.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Backend Orchestrators"
find packages/legal-council/orchestrators -name '*.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Backend Config"
find packages/legal-council/config -name '*.ts' ! -name '*.backup*' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Backend Services"
find packages/legal-council/services -name '*.ts' ! -name '*.backup*' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Backend Types"
find packages/legal-council/types -name '*.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Backend Utils"
find packages/legal-council/utils -name '*.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "API Routes"
find app/api -name 'route.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Frontend App"
find legal-council-ui-clean/src/app -name '*.tsx' -o -name '*.ts' -o -name '*.css' 2>/dev/null | grep -v '.OLD' | grep -v '.SIMPLE' | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Frontend Components + UI + Lib + Types"
find legal-council-ui-clean/src/shared -name '*.tsx' -o -name '*.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Frontend Stores"
find legal-council-ui-clean/src/stores -name '*.ts' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Law Base Scripts"
find agentis-law-base/scripts -name '*.js' -o -name '*.py' 2>/dev/null | sort > "$TMPLIST"
while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"

section "Config Files"
add_file package.json
add_file tsconfig.json
add_file middleware.ts
add_file legal-council-ui-clean/package.json
add_file legal-council-ui-clean/tsconfig.json
add_file legal-council-ui-clean/tailwind.config.ts
add_file legal-council-ui-clean/next.config.js
add_file legal-council-ui-clean/postcss.config.js
add_file env.example

###############################################################################

TOTAL_FILES=$(grep -c '^FILE:' "$OUTPUT")
TOTAL_LINES=$(wc -l < "$OUTPUT")

cat >> "$OUTPUT" << EOF


════════════════════════════════════════════════════════════════
  END OF PROJECT CODE
════════════════════════════════════════════════════════════════

Total Files: $TOTAL_FILES
Total Lines: $TOTAL_LINES
Generated: $TIMESTAMP
Project: AGENTIS Legal Council v2.1.0

════════════════════════════════════════════════════════════════
EOF

rm -f "$TMPLIST"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  DONE"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Files:  $TOTAL_FILES"
echo "  Lines:  $TOTAL_LINES"
echo "  Output: $OUTPUT"
echo "  Size:   $(du -h "$OUTPUT" | cut -f1)"
echo ""
