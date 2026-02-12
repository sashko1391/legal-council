#!/bin/bash
# ==============================================================================
# Legal Council - Generate ALL_CODE.txt
# Run this in your project root: bash generate-all-code.sh
# ==============================================================================

OUTPUT="ALL_CODE_UPDATED.txt"

cat > "$OUTPUT" << 'HEADER'
================================================================================
LEGAL COUNCIL - ПОВНИЙ КОД ПРОЕКТУ
================================================================================
Версія: 1.1.0 (Fully Operational)
Дата: 12 лютого 2026
Статус: ✅ Обидві системи працюють

Зміни Session 15:
- ✅ Next.js 14 compatibility
- ✅ JSON-safe prompts (OUTPUT LIMITS)
- ✅ ДСТУ 4163-2020 service (NEW)
- ✅ Format-aligned responses
- ✅ getAllLaws() method

================================================================================
ЗМІСТ
================================================================================

HEADER

echo "📦 Generating ALL_CODE_UPDATED.txt..."
echo ""

# Function to add file
add_file() {
    local file="$1"
    local title="$2"
    
    echo "Adding: $file"
    
    cat >> "$OUTPUT" << FILEHEADER

================================================================================
$title
================================================================================
FILE: $file
────────────────────────────────────────────────────────────────────────────

FILEHEADER
    
    if [ -f "$file" ]; then
        cat "$file" >> "$OUTPUT"
    else
        echo "// FILE NOT FOUND: $file" >> "$OUTPUT"
    fi
    
    echo "" >> "$OUTPUT"
}

# Add all files
add_file "packages/legal-council/config/models.ts" "1. MODELS CONFIG"
add_file "packages/legal-council/config/review-prompts.ts" "2. REVIEW PROMPTS (JSON-SAFE)"
add_file "packages/legal-council/config/generation-prompts.ts" "3. GENERATION PROMPTS (FORMAT-FIXED)"

add_file "packages/legal-council/types/review-types.ts" "4. REVIEW TYPES"
add_file "packages/legal-council/types/generation-types.ts" "5. GENERATION TYPES"
add_file "packages/core/orchestrator/types.ts" "6. CORE TYPES (FIXED)"

add_file "packages/legal-council/agents/base-agent.ts" "7. BASE AGENT"
add_file "packages/legal-council/agents/review/expert.ts" "8. EXPERT AGENT"
add_file "packages/legal-council/agents/review/provocateur.ts" "9. PROVOCATEUR AGENT"
add_file "packages/legal-council/agents/review/validator.ts" "10. VALIDATOR AGENT (REVIEW)"
add_file "packages/legal-council/agents/review/synthesizer.ts" "11. SYNTHESIZER AGENT"

add_file "packages/legal-council/agents/generation/analyzer.ts" "12. ANALYZER AGENT"
add_file "packages/legal-council/agents/generation/drafter.ts" "13. DRAFTER AGENT"
add_file "packages/legal-council/agents/generation/validator.ts" "14. VALIDATOR AGENT (GENERATION)"
add_file "packages/legal-council/agents/generation/polisher.ts" "15. POLISHER AGENT"

add_file "packages/legal-council/orchestrators/review-orchestrator.ts" "16. REVIEW ORCHESTRATOR"
add_file "packages/legal-council/orchestrators/generation-orchestrator.ts" "17. GENERATION ORCHESTRATOR"

add_file "packages/legal-council/services/ukrainian-law-service.ts" "18. UKRAINIAN LAW SERVICE (+ getAllLaws)"
add_file "packages/legal-council/services/dstu-service.ts" "19. ДСТУ SERVICE (NEW)"

add_file "app/api/review/route.ts" "20. REVIEW API ROUTE (NEXT.JS 14)"
add_file "app/api/generate/route.ts" "21. GENERATE API ROUTE (NEXT.JS 14)"

add_file ".env.example" "22. ENVIRONMENT VARIABLES"

# Add footer
cat >> "$OUTPUT" << 'FOOTER'

================================================================================
END OF FILE
================================================================================

Версія: 1.1.0
Дата: 12 лютого 2026
Тестів пройдено: 3/3 (100%)
Статус: ✅ Fully Operational

FOOTER

echo ""
echo "✅ Done!"
echo "📄 Generated: $OUTPUT"
echo ""
echo "File size:"
wc -l "$OUTPUT"
echo ""
echo "To view:"
echo "  less $OUTPUT"
echo "  cat $OUTPUT | grep 'FILE:'"
