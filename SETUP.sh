#!/bin/bash
# Legal Council - Project Setup Script
# Run this to create folder structure and place files

echo "🏗️  Creating Legal Council project structure..."

# Create root directory
mkdir -p legal-council
cd legal-council

# Create folder structure
echo "📁 Creating folders..."

mkdir -p app/api/review
mkdir -p app/api/generate
mkdir -p packages/core/orchestrator
mkdir -p packages/legal-council/types
mkdir -p packages/legal-council/config
mkdir -p packages/legal-council/services
mkdir -p packages/legal-council/agents/review
mkdir -p packages/legal-council/agents/generation
mkdir -p packages/legal-council/orchestrators

echo "✅ Folder structure created!"
echo ""
echo "📋 File placement guide:"
echo ""
echo "ROOT FILES (7):"
echo "  .env.example"
echo "  .gitignore"
echo "  .gitleaks.toml"
echo "  package.json"
echo "  tsconfig.json"
echo "  README.md"
echo "  PROJECT_CONTEXT.md"
echo "  DEVELOPMENT_LOG.md"
echo "  security-checklist.sh"
echo ""
echo "APP (2 files):"
echo "  app/api/review/route.ts"
echo "  app/api/generate/route.ts"
echo ""
echo "PACKAGES/CORE (1 file):"
echo "  packages/core/orchestrator/types.ts"
echo ""
echo "PACKAGES/LEGAL-COUNCIL (19 files):"
echo ""
echo "  Types (2):"
echo "    packages/legal-council/types/review-types.ts"
echo "    packages/legal-council/types/generation-types.ts"
echo ""
echo "  Config (3):"
echo "    packages/legal-council/config/models.ts"
echo "    packages/legal-council/config/review-prompts.ts"
echo "    packages/legal-council/config/generation-prompts.ts"
echo ""
echo "  Services (1):"
echo "    packages/legal-council/services/ukrainian-law-service.ts"
echo ""
echo "  Agents (9):"
echo "    packages/legal-council/agents/base-agent.ts"
echo "    packages/legal-council/agents/review/expert.ts"
echo "    packages/legal-council/agents/review/provocateur.ts"
echo "    packages/legal-council/agents/review/validator.ts"
echo "    packages/legal-council/agents/review/synthesizer.ts"
echo "    packages/legal-council/agents/generation/analyzer.ts"
echo "    packages/legal-council/agents/generation/drafter.ts"
echo "    packages/legal-council/agents/generation/validator.ts"
echo "    packages/legal-council/agents/generation/polisher.ts"
echo ""
echo "  Orchestrators (2):"
echo "    packages/legal-council/orchestrators/review-orchestrator.ts"
echo "    packages/legal-council/orchestrators/generation-orchestrator.ts"
echo ""
echo "✅ Structure ready! Now place files from downloads."
echo ""
echo "Next steps:"
echo "1. Place all downloaded files in correct folders (see above)"
echo "2. cp .env.example .env"
echo "3. Edit .env with your API keys"
echo "4. npm install"
echo "5. npm run dev"
