# 🇺🇦 AGENTIS — Контекст Проекту

**Версія:** 5.0.0 (Law Base Expansion + Two-Phase RAG + ПРД Prompts)  
**Дата:** 15 лютого 2026  
**Статус:** ✅ 207 законів, 22 151 вектор у Pinecone, two-phase RAG, ПРД prompts

---

## 📋 Огляд Проекту

**AGENTIS** — AI-система для аналізу та генерації юридичних документів, адаптована для українського законодавства з підтримкою ДСТУ 4163-2020.

**Жодних компромісів. Тільки найновіші моделі LLM, навчені національному законодавству.**

### Ключові характеристики:
- 🤖 **8 AI агентів** — 4 для аналізу контрактів, 4 для генерації документів
- 🇺🇦 **Українське законодавство** — 207 законів та кодексів (21 000+ статей)
- 🔍 **Two-phase RAG** — broad semantic + targeted legal anchor search (Pinecone)
- 📜 **ДСТУ 4163-2020** compliance для згенерованих документів
- 🧠 **3 LLM провайдери** — Claude, GPT, Gemini (мульти-агентна архітектура)
- ⚡ **Швидкість:** 60-90 секунд на повний аналіз
- 💰 **Вартість:** ~$0.001-0.003 за запит (dev mode)
- 🛡️ **Graceful degradation** — pipeline продовжує якщо агент впав
- 🔒 **Zero-dependency RAG** — native fetch замість важких SDK (~800MB економії)
- 📝 **ПРД (Принцип Розумної Достатності)** — contract generation без зайвих повторень закону
- 📋 **Blank handling** — шаблони з _______ для невідомих даних

---

## 🏗️ Архітектура

### Backend: AI Multi-Agent System

#### Система 1: Contract Review (Аналіз договорів)

```
CONTRACT INPUT (50–50,000 символів)
         │
         ▼
┌─────────────────────┐
│   1. EXPERT          │  ❗ REQUIRED
│   (GPT-4o-mini)      │  Two-phase RAG по 22 151 вектору
│   Timeout: 120s      │  UA type mapping (оренда→lease)
│   Retries: 3x        │  Знаходить TOP 7 issues
└──────────┬───────────┘
           │
           ▼
┌─────────────────────┐
│   2. PROVOCATEUR     │  ⚡ OPTIONAL
│   (Gemini FREE)      │  Шукає MAX 5 flaws
│   systemInstruction  │  як опонент
└──────────┬───────────┘
           │
           ▼
┌─────────────────────┐
│   3. VALIDATOR       │  ⚡ OPTIONAL
│   (Claude Sonnet)    │  Resilient output parsing
│   Alt-key mapping    │  Handles nested/flat JSON
└──────────┬───────────┘
           │
           ▼
┌─────────────────────┐
│   4. SYNTHESIZER     │  ⚡ OPTIONAL
│   (GPT-4o)           │  Фінальний звіт 🇺🇦
└──────────┬───────────┘
           │
           ▼
COMPREHENSIVE REPORT
  - Ризики + цитати з 207 законів
  - Рекомендації українською
  - JSON download (кнопка "Зберегти звіт")
```

#### Система 2: Document Generation (Генерація документів)

```
REQUIREMENTS INPUT (20–10,000 символів)
         │
         ▼
   1. ANALYZER  (❗ REQUIRED) → Pre-Generation Gate + readyToGenerate
         │
         ├── clarificationsNeeded? → UI запитує → "_______" = залишити порожнім
         │
         ▼
   2. DRAFTER   (❗ REQUIRED) → ДСТУ 4163-2020 документ + ПРД + blank placeholders
         │
         ▼
   3. GEN-VALIDATOR (⚡ OPTIONAL) → ПРД перевірка (sufficiency + conciseness)
         │
         ▼
   4. POLISHER  (⚡ OPTIONAL) → Фінальна версія (зберігає _______)
         │
         ▼
UKRAINIAN LEGAL DOCUMENT (3-6 сторінок, не 15-20)
```

### RAG Pipeline (Two-Phase Search)

```
Contract Text → OpenAI Embeddings → Phase 1: Broad Search (top 30)
                                         │
                                         ▼
                              Phase 2: Targeted Search
                              (legal anchor terms: ЦКУ ст., КЗпП, ЄДРПОУ...)
                                         │
                                         ▼
                              Merged + deduplicated results (top 15)
                                         │
                                         ▼
                              Expert Agent prompt
                              (contract + law context)
```

**RAG Service (law-rag-service.ts):**
- Zero dependencies — native `fetch()` до OpenAI та Pinecone API
- Two-phase search: broad semantic + targeted legal anchor terms
- Cached Pinecone host URL (resolved once per process)
- Без importance filter — семантична релевантність замість ручної фільтрації
- API key validation з зрозумілими помилками

**Law Database:**
- 207 законів та кодексів (14 кодексів + 193 закони)
- 21 000+ статей → 22 151 вектор у Pinecone (namespace: `ua-law-v1`)
- 35+ підзаконних НПА (sublaws-registry.js)
- Категоризація: 32+ типи, keyword tags, importance levels
- Universal parser для всіх типів НПА

### Frontend: Next.js 14 Web Application

```
http://localhost:3001
┌──────────────────────────────────────────┐
│  [🛡️ AGENTIS]  Головна  Аналіз  Генерація│
├──────────────────────────────────────────┤
│                                          │
│  Текст Договору   │   Огляд Ризиків      │
│  (IBM Plex Serif) │   (RiskDashboard)    │
│                   │                      │
│  Орендна плата... │   10 проблем         │
│                   │   85% впевненість    │
│                   │   4 критичних        │
│                   │                      │
│                   │   [Зберегти звіт]    │
│                   │                      │
├──────────────────────────────────────────┤
│  AGENTIS • © 2026 • Claude+GPT+Gemini   │
└──────────────────────────────────────────┘
```

Backend API: `http://localhost:3000`  
Frontend UI: `http://localhost:3001`

---

## 💾 Технологічний Стек

### Backend
```
packages/
├── core/orchestrator/
│   └── types.ts              # AgentRole (8), MODEL_PRICING
│
├── legal-council/
│   ├── agents/
│   │   ├── base-agent.ts     # AbortSignal→SDK, apostrophe-safe JSON repair
│   │   ├── review/
│   │   │   ├── expert.ts     # UA type mapping, two-phase RAG, logger
│   │   │   ├── provocateur.ts
│   │   │   ├── validator.ts  # Resilient transform
│   │   │   └── synthesizer.ts
│   │   └── generation/
│   │       ├── analyzer.ts   # Pre-Generation Gate
│   │       ├── drafter.ts    # ПРД + blank placeholders
│   │       ├── validator.ts  # ПРД sufficiency check
│   │       └── polisher.ts   # Preserves _______
│   │
│   ├── orchestrators/
│   │   ├── review-orchestrator.ts     # Multi-round + graceful degradation
│   │   └── generation-orchestrator.ts
│   │
│   ├── config/
│   │   ├── models.ts          # 3 env tiers, dynamic cost estimation
│   │   ├── review-prompts.ts  # 🇺🇦 Ukrainian language directive
│   │   └── generation-prompts.ts  # v2.1 ПРД + blank handling
│   │
│   ├── services/
│   │   ├── law-rag-service.ts        # Zero-dep two-phase RAG
│   │   ├── ukrainian-law-service.ts  # Static law references
│   │   └── dstu-service.ts           # ДСТУ formatting
│   │
│   ├── types/
│   │   ├── review-types.ts
│   │   └── generation-types.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── app/api/
│   ├── review/route.ts
│   └── generate/route.ts
│
└── middleware.ts               # CORS
```

### Law Base
```
agentis-law-base/
├── data/
│   ├── raw/             # 207 законів (.txt/.html з zakon.rada.gov.ua)
│   │   └── diy/         # Ручне завантаження НПА
│   ├── parsed/          # articles.json (universal parser output)
│   └── categorized/     # articles-categorized.json
│
└── scripts/
    ├── laws-registry.js       # 207 законів v3.1 (codes, URLs, categories)
    ├── sublaws-registry.js    # 35+ підзаконних НПА
    ├── download-laws.js       # v3: 7 стратегій завантаження з zakon.rada.gov.ua
    ├── parse-universal.js     # Universal parser для всіх типів НПА
    ├── 03-categorize.js       # Categories, tags, importance + article-range fallback
    ├── 04-embed.js            # Node.js: OpenAI embeddings → Pinecone upsert
    ├── import-diy.js          # Content-based matching для ручних НПА
    └── test-rag-quality.js    # 8 тестів RAG якості (7/8 passing → 8/8 target)
```

### Frontend
```
legal-council-ui-clean/src/
├── app/
│   ├── page.tsx              # Landing (8 agents, RAG, 3 LLM)
│   ├── (app)/review/page.tsx # Contract analysis + report download
│   ├── (app)/generate/page.tsx # Document generation + clarification + skip blank
│   └── layout.tsx
├── shared/components/        # Logo, Header, Footer, RiskDashboard, etc.
├── shared/ui/                # Button, Card, etc.
└── stores/                   # Zustand (analysis, ui)
```

**Models (testing mode):**
- Claude Sonnet 4.5 (Expert, Validator)
- GPT-4o (Synthesizer, Drafter)
- Gemini 2.5 Flash Lite (Provocateur — FREE)

**Vector DB:**
- Pinecone (free tier, cloud-hosted)
- Namespace: `ua-law-v1`
- 22 151 vectors, OpenAI `text-embedding-3-small`

---

## 📊 Поточний Статус

### ✅ Готово і Працює
- [x] 8 AI agents operational з graceful degradation
- [x] Two-phase RAG semantic search по 22 151 вектору (Pinecone)
- [x] 207 законів та кодексів у базі
- [x] 35+ підзаконних НПА
- [x] Universal parser для всіх типів НПА
- [x] Frontend ↔ Backend повністю інтегровані
- [x] Ukrainian contract type mapping (7 типів)
- [x] Multi-round orchestration з stop criteria
- [x] ПРД (Принцип Розумної Достатності) у generation prompts
- [x] Blank handling (_______) для невідомих даних
- [x] Pre-Generation Information Gate (readyToGenerate)
- [x] Apostrophe-safe JSON repair
- [x] AbortSignal timeout 120s (передається в SDK)
- [x] Zero-dependency RAG service (native fetch)
- [x] Report download (JSON)
- [x] Input size validation
- [x] Level-based logging
- [x] CORS middleware
- [x] Landing page з актуальною інформацією

### 🔄 Наступні Кроки
- [ ] Запуск pipeline для нових 6 НПА (parse → categorize → embed)
- [ ] RAG quality test 8/8 (зараз 7/8)
- [ ] SSE streaming для live agent updates
- [ ] File upload (PDF/DOCX parsing)
- [ ] History page (save/load analyses)
- [ ] Export PDF reports (замість JSON)

### ⏳ Заплановано (v3.0+)
- [ ] Dark mode
- [ ] Liga:ZAKON API integration
- [ ] User authentication
- [ ] Database (PostgreSQL)
- [ ] Team collaboration
- [ ] Mobile apps
- [ ] Fine-tuning для українського юридичного тексту

---

## 🚀 Як Запустити

```bash
# Terminal 1 — Backend (port 3000)
cd ~/Documents/Repositories/legal-council
npm run dev

# Terminal 2 — Frontend (port 3001)
cd ~/Documents/Repositories/legal-council/legal-council-ui-clean
npm run dev

# Open: http://localhost:3001
```

### Law database pipeline:
```bash
cd agentis-law-base

# 1. Завантажити нові закони
node scripts/download-laws.js --skip-existing

# 2. Імпортувати ручні НПА (з diy/ папки)
node scripts/import-diy.js --apply

# 3. Парсити всі закони
node scripts/parse-universal.js

# 4. Категоризувати
node scripts/03-categorize.js

# 5. Embeddings + Pinecone upload
node scripts/04-embed.js

# 6. Тестувати RAG якість
node scripts/test-rag-quality.js --verbose
```

### Збір коду для аналізу:
```bash
chmod +x collect-all-code.sh
./collect-all-code.sh              # → COMPLETE_CODE_YYYYMMDD.txt
```

---

**Версія:** 5.0.0  
**Останнє оновлення:** 15 лютого 2026  
**Автори:** Claude + Олександр  
**Статус:** 🟢 Full-Stack Operational — 207 законів, 22 151 вектор, two-phase RAG
