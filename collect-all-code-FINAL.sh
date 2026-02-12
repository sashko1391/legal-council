#!/bin/bash

###############################################################################
# Legal Council - COMPLETE CODE COLLECTION (Auto-detect)
###############################################################################

set -e

OUTPUT_FILE="COMPLETE_PROJECT_CODE.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  LEGAL COUNCIL - COLLECTING ALL CODE${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Initialize
cat > "$OUTPUT_FILE" << 'HEADER'
═══════════════════════════════════════════════════════════════════════
  LEGAL COUNCIL (AGENTIS) - COMPLETE PROJECT CODE
═══════════════════════════════════════════════════════════════════════

Generated: TIMESTAMP_PLACEHOLDER

This file contains ALL source code from the Legal Council project:
- Backend AI System (8 agents, orchestrators, services)
- Frontend Next.js UI (components, pages, stores)
- API Routes (review, generate)
- Configuration (package.json, tsconfig, tailwind)
- Documentation

═══════════════════════════════════════════════════════════════════════
HEADER

sed -i "s/TIMESTAMP_PLACEHOLDER/$TIMESTAMP/" "$OUTPUT_FILE"

total_files=0

# Helper function
add_file() {
    local file=$1
    
    echo "" >> "$OUTPUT_FILE"
    echo "═══════════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
    echo "FILE: $file" >> "$OUTPUT_FILE"
    echo "═══════════════════════════════════════════════════════════════════════" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    ((total_files++))
    echo -e "${GREEN}✓${NC} $file"
}

###############################################################################
# COLLECT ALL CODE FILES
###############################################################################

echo -e "${CYAN}━━━ Backend AI Agents${NC}"
find packages/legal-council/agents -type f -name "*.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Backend Orchestrators${NC}"
find packages/legal-council/orchestrators -type f -name "*.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Backend Configuration${NC}"
find packages/legal-council/config -type f -name "*.ts" ! -name "*.backup*" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Backend Services${NC}"
find packages/legal-council/services -type f -name "*.ts" ! -name "*.backup*" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Backend Types${NC}"
find packages/legal-council/types -type f -name "*.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Frontend App Router${NC}"
find legal-council-ui-clean/src/app -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) ! -name "*.OLD*" ! -name "*.SIMPLE*" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Frontend Components${NC}"
find legal-council-ui-clean/src/shared/components -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Frontend UI Components${NC}"
find legal-council-ui-clean/src/shared/ui -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Frontend Lib & Types${NC}"
find legal-council-ui-clean/src/shared/lib -type f -name "*.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done
find legal-council-ui-clean/src/shared/types -type f -name "*.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Frontend Stores${NC}"
find legal-council-ui-clean/src/stores -type f -name "*.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ API Routes (Root)${NC}"
find app/api -type f -name "route.ts" 2>/dev/null | sort | while read file; do
    add_file "$file"
done

echo ""
echo -e "${CYAN}━━━ Configuration Files${NC}"
for file in package.json tsconfig.json legal-council-ui-clean/package.json legal-council-ui-clean/tsconfig.json legal-council-ui-clean/tailwind.config.ts legal-council-ui-clean/next.config.js legal-council-ui-clean/postcss.config.js; do
    if [ -f "$file" ]; then
        add_file "$file"
    fi
done

echo ""
echo -e "${CYAN}━━━ Documentation${NC}"
for file in README.md PROJECT_CONTEXT.md DEVELOPMENT_LOG.md AI_CONSENSUS_REPORT.md IMPLEMENTATION_SUMMARY.md legal-council-ui-clean/README.md; do
    if [ -f "$file" ]; then
        add_file "$file"
    fi
done

###############################################################################
# FOOTER
###############################################################################

cat >> "$OUTPUT_FILE" << EOF


═══════════════════════════════════════════════════════════════════════
  END OF PROJECT CODE
═══════════════════════════════════════════════════════════════════════

Total Files: $total_files
Generated: $TIMESTAMP

Project: Legal Council (AGENTIS)
Version: 2.0.0

Backend: 8 AI agents, 2 orchestrators, services, config
Frontend: Next.js 14, React components, Zustand stores
Tech: TypeScript, Tailwind CSS, Anthropic/OpenAI/Google APIs

═══════════════════════════════════════════════════════════════════════
EOF

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  COMPLETE!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Total files: $total_files"
echo "Output: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo -e "${GREEN}✓ All code collected successfully!${NC}"
echo ""
