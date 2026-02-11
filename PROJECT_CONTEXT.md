# Legal Council - Project Context

**Created:** February 10, 2026  
**Status:** Backend Complete, Ready for API & UI  
**Environment:** Testing mode (Sonnet as Expert for cost optimization)

---

## 🎯 Project Vision

**Multi-agent AI legal platform with 2 specialized councils:**

### Tab 1: Contract Review 📋
Upload contract → 4 AI agents analyze → Executive report with risks & recommendations

### Tab 2: Document Generation 📝
Describe requirements → 4 AI agents draft → ДСТУ-compliant Ukrainian contract

---

## 🏗️ Architecture Overview

### Shared Core Pattern
```
┌─────────────────────────────────────────────┐
│     SHARED ORCHESTRATION ENGINE             │
│  - Tick-based cycle (from Trading Council)  │
│  - Priority-based conflict resolution       │
│  - Stop criteria framework                  │
│  - Audit trail / Historian                  │
└─────────────────────────────────────────────┘
           ↓                    ↓
    CONTRACT REVIEW      DOCUMENT GENERATION
    (4 agents)           (4 agents)
```

### Contract Review Agents
1. **Expert** (Claude Sonnet 4.5 in testing) - Comprehensive legal analysis
2. **Provocateur** (Gemini Flash - FREE) - Adversarial red-team critic
3. **Validator** (Claude Sonnet 4.5) - Completeness checker
4. **Synthesizer** (GPT-4) - Executive summary

### Document Generation Agents
1. **Analyzer** (Claude Sonnet 4.5) - Requirements parser
2. **Drafter** (GPT-4) - ДСТУ-compliant contract writer
3. **Validator** (Claude Sonnet 4.5) - Legal compliance checker
4. **Polisher** (Claude Sonnet 4.5) - Final quality polish

---

## 💰 Cost Optimization Strategy

### Environment Modes
```typescript
// .env: LEGAL_COUNCIL_ENV=testing|production|development

PRODUCTION: Claude Opus everywhere (~$0.51/review, $0.65/generation)
TESTING:    Claude Sonnet as Expert (~$0.14/review, $0.18/generation) ✅ Current
DEVELOPMENT: Maximum savings (~$0.09/review, $0.12/generation)
```

**Testing mode = 72% cost reduction** while maintaining 80-90% quality.

---

## 🇺🇦 Ukrainian Law Integration

### ДСТУ 4163-2020 Compliance
All generated documents follow Ukrainian document standards:
- Mandatory sections (ПРЕДМЕТ ДОГОВОРУ, ВАРТІСТЬ, etc.)
- Date format: ДД.ММ.РРРР (01.02.2025)
- Currency: гривні (not USD)
- Terminology: Замовник/Виконавець (not Client/Contractor)

### Legal Database (MVP)
**Hardcoded common laws:**
- ЦКУ (Цивільний кодекс) - general contracts
- ГКУ (Господарський кодекс) - commercial agreements
- КЗпП (Кодекс законів про працю) - employment

**Future:** Scraping zakon.rada.gov.ua or Liga:ZAKON API integration

### Ukrainian Law Service
`packages/legal-council/services/ukrainian-law-service.ts`

Features:
- Get law references with articles
- Format dates/currency per Ukrainian standards
- Generate legal context for LLM prompts
- ДСТУ structure templates

---

## 📁 File Structure (18 Files Created)

```
legal-council/
├── packages/
│   ├── core/
│   │   └── orchestrator/
│   │       └── types.ts                      # Shared types
│   │
│   └── legal-council/
│       ├── types/
│       │   ├── review-types.ts               # Contract review types
│       │   └── generation-types.ts           # Document generation types
│       │
│       ├── config/
│       │   ├── models.ts                     # Model configs (prod/test/dev)
│       │   ├── review-prompts.ts             # 4 review agent prompts
│       │   └── generation-prompts.ts         # 4 generation prompts (ДСТУ)
│       │
│       ├── services/
│       │   └── ukrainian-law-service.ts      # Law references & ДСТУ
│       │
│       ├── agents/
│       │   ├── base-agent.ts                 # Unified API calls
│       │   ├── review/
│       │   │   ├── expert.ts
│       │   │   ├── provocateur.ts
│       │   │   ├── validator.ts
│       │   │   └── synthesizer.ts
│       │   └── generation/
│       │       ├── analyzer.ts
│       │       ├── drafter.ts
│       │       ├── validator.ts
│       │       └── polisher.ts
│       │
│       └── orchestrators/
│           ├── review-orchestrator.ts        # Coordinates review
│           └── generation-orchestrator.ts    # Coordinates generation
```

---

## 🔑 Key Design Decisions

### 1. Web-First, Not Native App
**Decision:** Start with Next.js web app + PWA  
**Reasoning:**
- Lawyers work 80% on desktop
- Faster MVP (2-3 weeks vs 6-8 weeks)
- No App Store 30% tax
- Instant distribution (share URL)
- Can add native later if metrics show mobile usage

### 2. 4 Agents (Not 3)
**Decision:** Keep Synthesizer as 4th LLM agent (not deterministic template)  
**Reasoning:**
- Legal outputs need natural language synthesis (can't just concatenate)
- Template outputs read "robotic"
- Extra $0.08/query justified for client-ready polish
- Handles contradictions intelligently

### 3. Sonnet as Expert in Testing
**Decision:** Use Claude Sonnet (not Opus) for Expert role during development  
**Reasoning:**
- 7x cheaper ($0.05 vs $0.375 per query)
- 80-90% quality of Opus
- Perfect for iteration/testing
- Switch to Opus for production via env variable

### 4. Ukrainian Law Hardcoded (MVP)
**Decision:** Hardcode ЦКУ/ГКУ/КЗпП articles, not live scraping  
**Reasoning:**
- Laws don't change daily
- Scraping zakon.rada.gov.ua adds complexity
- 90% of contracts use same 20 articles
- Can add live API later (Liga:ZAKON $50/mo)

---

## 🎨 System Prompt Philosophy

### Review Prompts
**Expert:** Comprehensive, objective, cites Ukrainian law  
**Provocateur:** GAME-IFIED - "Find 3+ flaws or you FAILED" (prevents polite agreement)  
**Validator:** Strict QA checklist  
**Synthesizer:** Weighted synthesis (Validator 40%, Expert 30%, Critic 30%)

### Generation Prompts
**Analyzer:** Smart defaults (assumes Ukraine jurisdiction)  
**Drafter:** FULL ДСТУ template embedded in prompt (1500+ chars example)  
**Validator:** ЦКУ ст. 638 compliance checklist  
**Polisher:** Clarity improvements, executive summary generation

---

## 🔄 Stop Criteria (Review Orchestrator)

System stops iteration when ANY of:
1. **Max rounds reached** (3 rounds hard limit)
2. **No high-severity issues** (no issues with severity ≥ 3)
3. **High confidence** (avg confidence ≥ 85%)
4. **Validator verdict COMPLETE**

Current MVP: Single-pass (no actual iteration), but infrastructure ready.

---

## 🧪 Testing Strategy

### Unit Testing (Without API Calls)
```bash
# Mock responses for each agent
npm test
```

### Integration Testing (With Real APIs)
```bash
# Set LEGAL_COUNCIL_ENV=testing
# Uses Sonnet + Gemini (cheap)
npm run test:integration
```

### Cost Tracking
Every agent call logs:
- Input/output tokens
- Cost calculation
- Latency

Orchestrator sums total cost per query.

---

## 📊 Expected Performance (Testing Mode)

### Contract Review
- **Latency:** ~8-12 seconds (4 sequential API calls)
- **Cost:** ~$0.14 per contract
- **Quality:** 80-90% of production (sufficient for MVP)

### Document Generation
- **Latency:** ~12-18 seconds
- **Cost:** ~$0.18 per document
- **Quality:** ДСТУ-compliant, Ukrainian law references

### Scaling to 100 Users/Day
- Review: 50 contracts/day = $7/day
- Generation: 50 documents/day = $9/day
- **Total: ~$500/month API costs**

---

## 🚀 Next Steps (For New Chat)

### Immediate Priorities
1. **Create API routes** (`/api/review`, `/api/generate`)
2. **Create package.json** with dependencies
3. **Create .env.example** template
4. **Simple test UI** for manual testing

### Dependencies Needed
```json
{
  "@anthropic-ai/sdk": "^0.20.0",
  "openai": "^4.28.0",
  "@google/generative-ai": "^0.2.0",
  "next": "^14.1.0",
  "react": "^18.2.0",
  "typescript": "^5.3.0"
}
```

### Environment Variables
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
LEGAL_COUNCIL_ENV=testing
```

---

## 💡 Key Insights from Development

### What Worked Well
✅ Reusing Trading Council tick-based architecture  
✅ Gemini Flash FREE tier for Provocateur (huge savings)  
✅ Hardcoded Ukrainian law (faster than scraping)  
✅ Game-ified Provocateur prompt (forces adversarial thinking)  
✅ ДСТУ template in prompt (ensures compliance)

### Challenges Solved
✅ **LLM politeness** → Provocateur game mechanics  
✅ **Cost control** → Environment-based model configs  
✅ **Ukrainian standards** → Full ДСТУ template + UkrainianLawService  
✅ **API abstraction** → BaseAgent class (unified Anthropic/OpenAI/Google)

### Open Questions
⚠️ Multi-round iteration not yet implemented (MVP single-pass only)  
⚠️ No actual zakon.rada.gov.ua integration (future)  
⚠️ UI not yet created (just backend)  
⚠️ No authentication/user management (future)

---

## 🎓 Lessons for Next Developer

### If You're Adding Features
1. **New agent role:** Extend `BaseAgent`, add to config, create prompt
2. **New document type:** Add to `DocumentType`, update Analyzer suggestions
3. **New law:** Add to `COMMON_LAWS` in ukrainian-law-service.ts
4. **Cost optimization:** Adjust model configs in `models.ts`

### If You're Debugging
- Check `LEGAL_COUNCIL_ENV` - might be in wrong mode
- Validate API keys in `.env`
- Look at agent `console.log` outputs (orchestrator shows step-by-step)
- Token usage tracked in every `BaseAgentOutput.tokensUsed`

### If You're Deploying
- Set `LEGAL_COUNCIL_ENV=production` for best quality
- Ensure all 3 API keys present (Anthropic, OpenAI, Google)
- Budget ~$0.50/query for production mode
- Consider rate limiting (agents make 4-8 API calls per query)

---

## 📚 Related Projects

**Trading Council** - Sister project with similar architecture  
Location: `/mnt/user-data/uploads/` (files in current context)  
- Also uses tick-based orchestration
- Also has 4 agents (Grok, Claude, Gemini, Aggregator)
- Difference: Trading uses deterministic Aggregator, Legal uses LLM Synthesizer

---

## 🔗 External Resources

### APIs in Use
- Anthropic Claude API: https://console.anthropic.com/
- OpenAI GPT API: https://platform.openai.com/
- Google Gemini API: https://aistudio.google.com/apikey

### Ukrainian Law
- Official database: https://zakon.rada.gov.ua/
- ДСТУ standards: Referenced in generation prompts
- Liga:ZAKON (commercial): https://ligazakon.net/ (future integration)

### Documentation
- Anthropic SDK: https://docs.anthropic.com/
- OpenAI SDK: https://platform.openai.com/docs/
- Google GenAI SDK: https://ai.google.dev/

---

## ⚙️ Configuration Quick Reference

```typescript
// Switch environments
LEGAL_COUNCIL_ENV=production  // Best quality, expensive
LEGAL_COUNCIL_ENV=testing     // Good quality, 70% cheaper ✅
LEGAL_COUNCIL_ENV=development // Max savings, for debugging

// Model mapping (testing mode)
Expert:       claude-sonnet-4-5-20250929
Provocateur:  gemini-2.0-flash-thinking-exp-01-21 (FREE!)
Validator:    claude-sonnet-4-5-20250929
Synthesizer:  gpt-4o

// Orchestrator settings
maxRounds: 3
maxSeverityThreshold: 3
minConfidence: 0.85
```

---

**End of Project Context**  
**Last Updated:** February 10, 2026  
**Next Chat Should:** Continue from API routes or UI implementation
