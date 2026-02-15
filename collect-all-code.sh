#!/bin/bash

###############################################################################
# AGENTIS — COLLECT ALL CODE (v3.0)
# Feb 15, 2026 — повний збір коду + конфігів + скриптів + документації
###############################################################################

DATE_SUFFIX=$(date '+%Y%m%d')
OUTPUT="COMPLETE_CODE_${DATE_SUFFIX}.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
TMPLIST=$(mktemp)
FILE_COUNT=0

cat > "$OUTPUT" << HEADER
═══════════════════════════════════════════════════════════════════════
  AGENTIS LEGAL COUNCIL — COMPLETE PROJECT CODE
═══════════════════════════════════════════════════════════════════════

Generated: $TIMESTAMP

Backend:  8 AI agents, 2 orchestrators, services, RAG
Frontend: Next.js 14, React, Zustand, Tailwind CSS
Law Base: 207 законів, 22 151 vectors у Pinecone (namespace: ua-law-v1)
LLM:      Anthropic Claude, OpenAI GPT, Google Gemini

═══════════════════════════════════════════════════════════════════════

HEADER

add_file() {
    local filepath="$1"
    if [ ! -f "$filepath" ]; then return; fi

    # Пропускаємо бінарні, lock-файли, бекапи
    case "$filepath" in
        *.lock|*.lock.json|*.backup*|*.OLD*|*.SIMPLE*|*.bak) return ;;
        *node_modules*|*.next*|*.git/*|*dist/*) return ;;
        *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff*|*.ttf|*.eot) return ;;
    esac

    # Пропускаємо файли > 500KB (великі дані)
    local size
    size=$(wc -c < "$filepath" 2>/dev/null || echo 0)
    if [ "$size" -gt 512000 ]; then
        echo "  ⊘ SKIP (>500KB): $filepath"
        return
    fi

    echo "" >> "$OUTPUT"
    echo "════════════════════════════════════════════════════════════════" >> "$OUTPUT"
    echo "FILE: $filepath" >> "$OUTPUT"
    echo "════════════════════════════════════════════════════════════════" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    cat "$filepath" >> "$OUTPUT"
    echo "" >> "$OUTPUT"
    FILE_COUNT=$((FILE_COUNT + 1))
    echo "  ✓ $filepath"
}

add_files_from_find() {
    local dir="$1"
    shift
    # Всі решта аргументів — це параметри find
    find "$dir" "$@" 2>/dev/null | grep -v '.OLD' | grep -v '.SIMPLE' | grep -v '.backup' | grep -v 'node_modules' | grep -v '.next' | sort > "$TMPLIST"
    while IFS= read -r f; do add_file "$f"; done < "$TMPLIST"
}

section() {
    echo ""
    echo "━━━ $1"
    echo "" >> "$OUTPUT"
    echo "###################################################################" >> "$OUTPUT"
    echo "# SECTION: $1" >> "$OUTPUT"
    echo "###################################################################" >> "$OUTPUT"
}

###############################################################################
# 1. PROJECT TREE
###############################################################################

section "Project Tree"
{
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "FILE: [TREE OUTPUT]"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    if command -v tree &>/dev/null; then
        tree -I 'node_modules|.next|.git|dist|package-lock.json' -L 4 --charset utf-8 2>/dev/null || echo "(tree не встановлений)"
    else
        echo "(tree не встановлений — використовуємо find)"
        find . -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' -not -path '*/dist/*' -maxdepth 4 | sort
    fi
    echo ""
} >> "$OUTPUT"
FILE_COUNT=$((FILE_COUNT + 1))
echo "  ✓ [TREE OUTPUT]"

###############################################################################
# 2. CORE TYPES
###############################################################################

section "Core Types"
add_files_from_find packages/core -name '*.ts'

###############################################################################
# 3. BACKEND — AGENTS
###############################################################################

section "Backend Agents"
add_files_from_find packages/legal-council/agents -name '*.ts'

###############################################################################
# 4. BACKEND — ORCHESTRATORS
###############################################################################

section "Backend Orchestrators"
add_files_from_find packages/legal-council/orchestrators -name '*.ts'

###############################################################################
# 5. BACKEND — CONFIG
###############################################################################

section "Backend Config"
add_files_from_find packages/legal-council/config -name '*.ts'

###############################################################################
# 6. BACKEND — SERVICES
###############################################################################

section "Backend Services"
add_files_from_find packages/legal-council/services -name '*.ts'

###############################################################################
# 7. BACKEND — TYPES
###############################################################################

section "Backend Types"
add_files_from_find packages/legal-council/types -name '*.ts'

###############################################################################
# 8. BACKEND — UTILS
###############################################################################

section "Backend Utils"
add_files_from_find packages/legal-council/utils -name '*.ts'

###############################################################################
# 9. API ROUTES (всі, включаючи export, upload)
###############################################################################

section "API Routes (Backend)"
add_files_from_find app/api \( -name '*.ts' -o -name '*.tsx' \)

###############################################################################
# 10. MIDDLEWARE + ROOT BACKEND
###############################################################################

section "Root Backend Files"
add_file middleware.ts

# src/services та src/shared (якщо є файли)
add_files_from_find src -name '*.ts' -o -name '*.tsx'

###############################################################################
# 11. FRONTEND — APP (pages, layouts, routes, css)
###############################################################################

section "Frontend App (pages, layouts, api proxies)"
add_files_from_find legal-council-ui-clean/src/app \( -name '*.tsx' -o -name '*.ts' -o -name '*.css' \)

###############################################################################
# 12. FRONTEND — SHARED (components, ui, lib, types)
###############################################################################

section "Frontend Shared (components, ui, lib, types)"
add_files_from_find legal-council-ui-clean/src/shared \( -name '*.tsx' -o -name '*.ts' \)

###############################################################################
# 13. FRONTEND — STORES
###############################################################################

section "Frontend Stores"
add_files_from_find legal-council-ui-clean/src/stores -name '*.ts'

###############################################################################
# 14. LAW BASE SCRIPTS
###############################################################################

section "Law Base Scripts"
add_files_from_find agentis-law-base/scripts \( -name '*.js' -o -name '*.py' -o -name '*.ts' -o -name '*.sh' \)

###############################################################################
# 15. LAW BASE PIPELINE DOC
###############################################################################

section "Law Base Pipeline Doc"
add_file agentis-law-base/PIPELINE.md

###############################################################################
# 16. SHELL SCRIPTS (root + scripts/)
###############################################################################

section "Shell Scripts"
add_file SETUP.sh
add_file security-checklist.sh
add_files_from_find scripts -name '*.sh'

###############################################################################
# 17. CONFIG FILES
###############################################################################

section "Config Files (root)"
add_file package.json
add_file tsconfig.json
add_file env.example
add_file next-env.d.ts

section "Config Files (frontend)"
add_file legal-council-ui-clean/package.json
add_file legal-council-ui-clean/tsconfig.json
add_file legal-council-ui-clean/tailwind.config.ts
add_file legal-council-ui-clean/next.config.js
add_file legal-council-ui-clean/postcss.config.js
add_file legal-council-ui-clean/next-env.d.ts

###############################################################################
# 18. DOCUMENTATION (markdown)
###############################################################################

section "Documentation"
# Кореневі .md файли (крім COMPLETE_CODE та надто великих логів)
for mdfile in *.md; do
    [ -f "$mdfile" ] || continue
    case "$mdfile" in
        COMPLETE_CODE*) continue ;;
    esac
    add_file "$mdfile"
done

# Frontend .md файли
for mdfile in legal-council-ui-clean/*.md; do
    [ -f "$mdfile" ] || continue
    add_file "$mdfile"
done

###############################################################################
# FOOTER
###############################################################################

TOTAL_LINES=$(wc -l < "$OUTPUT")

cat >> "$OUTPUT" << EOF


═══════════════════════════════════════════════════════════════════════
  END OF PROJECT CODE
═══════════════════════════════════════════════════════════════════════

Total Files:   $FILE_COUNT
Total Lines:   $TOTAL_LINES
Generated:     $TIMESTAMP
Project:       AGENTIS Legal Council v5.0.0
Law Coverage:  207 законів + 35 підзаконних НПА
Vectors:       22 151 (Pinecone, namespace ua-law-v1)

═══════════════════════════════════════════════════════════════════════
EOF

rm -f "$TMPLIST"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  DONE — collect-all-code.sh v3.0"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Files:  $FILE_COUNT"
echo "  Lines:  $TOTAL_LINES"
echo "  Output: $OUTPUT"
echo "  Size:   $(du -h "$OUTPUT" | cut -f1)"
echo ""
