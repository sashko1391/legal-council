#!/bin/bash
# ================================================
# AGENTIS — Apply patches for #23 and #24
# Run from project root: bash scripts/apply-patches.sh
# ================================================

set -e

echo "📝 Applying patch #23: Remove duplicate buildGenerationValidatorPrompt..."

# #23: Remove the wrapper function from generation-prompts.ts
# The generation validator now imports buildValidatorPrompt directly
GENP="packages/legal-council/config/generation-prompts.ts"
if grep -q "buildGenerationValidatorPrompt" "$GENP"; then
  # Remove the backward compatibility wrapper (lines with the function)
  sed -i '/^\/\/ Backward compatibility$/d' "$GENP"
  sed -i '/^export async function buildGenerationValidatorPrompt/,/^}$/d' "$GENP"
  echo "   ✅ Removed buildGenerationValidatorPrompt wrapper from $GENP"
else
  echo "   ⏭️  Already removed or not found"
fi


echo ""
echo "📝 Applying patch #24: Improve validateSection stub with logging..."

# #24: Replace the validateSection stub with one that logs usage
LAWSVC="packages/legal-council/services/ukrainian-law-service.ts"
if grep -q "// TODO: Implement actual validation logic" "$LAWSVC"; then
  # Replace the stub with a better version
  sed -i 's|// TODO: Implement actual validation logic|// TODO: Integrate with vector database for real validation|' "$LAWSVC"
  sed -i 's|// For MVP, just return valid|console.warn(`⚠️ validateSection() stub called for ${lawCode} art.${article} — real validation not yet implemented`);|' "$LAWSVC"
  echo "   ✅ Improved validateSection stub in $LAWSVC"
else
  echo "   ⏭️  Already patched or not found"
fi

echo ""
echo "✅ Patches applied!"
