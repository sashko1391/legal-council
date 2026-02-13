#!/bin/bash
# ================================================
# AGENTIS — Patch: Force Ukrainian language in prompts
# 
# Problem: All agent prompts are in English, agents respond in English
# Fix: Add Ukrainian language directive to each prompt
#
# Usage: cd ~/Documents/Repositories/legal-council && bash scripts/patch-language.sh
# ================================================

set -e

REVIEW_PROMPTS="packages/legal-council/config/review-prompts.ts"
GEN_PROMPTS="packages/legal-council/config/generation-prompts.ts"

echo "🇺🇦 Patching prompts to force Ukrainian language output..."

# ==========================================
# REVIEW PROMPTS
# ==========================================

# EXPERT PROMPT — add Ukrainian directive after TONE line
if grep -q "TONE: Professional, precise, balanced." "$REVIEW_PROMPTS"; then
  sed -i 's|TONE: Professional, precise, balanced.|TONE: Professional, precise, balanced.\n\n🇺🇦 МОВА ВІДПОВІДІ: УКРАЇНСЬКА\nВСІ текстові значення у JSON (summary, description, title, action, rationale, specificLanguage, issue, exploitationScenario, suggestedFix) ПОВИННІ бути УКРАЇНСЬКОЮ МОВОЮ.\nJSON ключі залишаються англійською (executiveSummary, keyIssues, severity тощо).\nПосилання на закони: "ЦКУ ст. 626", "ГКУ ст. 180", "КЗпП ст. 36" тощо.|' "$REVIEW_PROMPTS"
  echo "   ✅ Expert prompt patched"
else
  echo "   ⏭️  Expert prompt already patched or not found"
fi

# PROVOCATEUR PROMPT — add Ukrainian directive after TONE line
if grep -q "TONE: Aggressive, creative, ruthless." "$REVIEW_PROMPTS"; then
  sed -i 's|TONE: Aggressive, creative, ruthless.|TONE: Aggressive, creative, ruthless.\n\n🇺🇦 МОВА ВІДПОВІДІ: УКРАЇНСЬКА\nВСІ текстові значення у JSON ПОВИННІ бути УКРАЇНСЬКОЮ МОВОЮ.\nJSON ключі залишаються англійською.|' "$REVIEW_PROMPTS"
  echo "   ✅ Provocateur prompt patched"
else
  echo "   ⏭️  Provocateur prompt already patched or not found"
fi

# VALIDATOR PROMPT — add Ukrainian directive after TONE line
if grep -q "TONE: Strict but fair." "$REVIEW_PROMPTS"; then
  sed -i 's|TONE: Strict but fair.|TONE: Strict but fair.\n\n🇺🇦 МОВА ВІДПОВІДІ: УКРАЇНСЬКА\nВСІ текстові значення у JSON ПОВИННІ бути УКРАЇНСЬКОЮ МОВОЮ.\nJSON ключі залишаються англійською.|' "$REVIEW_PROMPTS"
  echo "   ✅ Validator prompt patched"
else
  echo "   ⏭️  Validator prompt already patched or not found"
fi

# SYNTHESIZER PROMPT — add Ukrainian directive after TONE line
if grep -q "TONE: Confident, clear, actionable." "$REVIEW_PROMPTS"; then
  sed -i 's|TONE: Confident, clear, actionable.|TONE: Confident, clear, actionable.\n\n🇺🇦 МОВА ВІДПОВІДІ: УКРАЇНСЬКА\nВСІ текстові значення у JSON (summary, title, description, impact, mitigation, action, rationale, specificLanguage) ПОВИННІ бути УКРАЇНСЬКОЮ МОВОЮ.\nJSON ключі залишаються англійською.\nСтиль: як досвідчений український юрист пише клієнту.|' "$REVIEW_PROMPTS"
  echo "   ✅ Synthesizer prompt patched"
else
  echo "   ⏭️  Synthesizer prompt already patched or not found"
fi

# ==========================================
# GENERATION PROMPTS
# ==========================================

if [ -f "$GEN_PROMPTS" ]; then
  # Add Ukrainian directive to generation prompts too
  # ANALYZER
  if grep -q "OUTPUT FORMAT (strict JSON):" "$GEN_PROMPTS" && ! grep -q "МОВА ВІДПОВІДІ" "$GEN_PROMPTS"; then
    # Add a general Ukrainian directive near the top of the file
    sed -i '0,/OUTPUT FORMAT (strict JSON):/{s|OUTPUT FORMAT (strict JSON):|🇺🇦 МОВА: Всі текстові значення у JSON — УКРАЇНСЬКОЮ МОВОЮ. JSON ключі — англійською.\n\nOUTPUT FORMAT (strict JSON):|;}' "$GEN_PROMPTS"
    echo "   ✅ Generation prompts patched"
  else
    echo "   ⏭️  Generation prompts already patched or not found"
  fi
fi

echo ""
echo "✅ Language patch complete!"
echo "   Restart both servers: npm run dev"
