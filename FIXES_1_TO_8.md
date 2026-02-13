# AGENTIS — Виправлення Проблем #1-8

**Дата:** 13 лютого 2026  
**Версія:** 1.2.0  
**Статус:** ✅ Всі 8 проблем виправлено

---

## Змінені файли

| # | Файл | Проблеми |
|---|------|----------|
| 1 | `packages/legal-council/agents/base-agent.ts` | #4, #6, #7, #8 |
| 2 | `legal-council-ui-clean/src/app/(app)/review/page.tsx` | #1, #2, #3 |
| 3 | `legal-council-ui-clean/src/app/api/review/route.ts` | #1 |
| 4 | `.env.example` | #5 |

---

## Детальний опис виправлень

### 🔴 #1 — Frontend використовував Mock API замість реального бекенду

**Файл:** `legal-council-ui-clean/src/app/api/review/route.ts`

**Було:** `generateMockRisks()` з захардкодженими фейковими ризиками, `sleep(3000)` для симуляції.

**Стало:** Проксі-маршрут з двома режимами роботи:
- **Mode 1 (Proxy):** Якщо `NEXT_PUBLIC_API_URL` або `BACKEND_URL` встановлено → проксює запит на реальний бекенд
- **Mode 2 (Direct import):** Якщо URL не встановлено → імпортує `ReviewOrchestrator` напряму (monorepo)
- Якщо обидва варіанти не працюють → повертає зрозуміле повідомлення 503 з інструкціями

**Файл:** `legal-council-ui-clean/src/app/(app)/review/page.tsx`
- Запит тепер йде через проксі до реального бекенду

---

### 🔴 #2 — Неузгоджена структура API vs Frontend

**Файл:** `legal-council-ui-clean/src/app/(app)/review/page.tsx`

**Було:** `setRisks(result.data.risks || [])` — поле `risks` не існує в `ContractReviewResponse`.

**Стало:** Додана функція `mapResponseToRisks()` яка перетворює:
- `criticalRisks[]` → RiskItem з severity=5, agentName='Синтезатор'
- `detailedAnalysis.expertAnalysis.issues[]` → RiskItem з реальною severity, agentName='Експерт'
- `detailedAnalysis.flawsFound[]` → RiskItem з реальною severity, agentName='Провокатор'
- `recommendations[]` → RiskItem з severity по priority (high→3, medium→2, low→1), agentName='Валідатор'

Маппінг дедуплікує по title щоб уникнути дублів між різними джерелами.

Також додано відображення `summary` та `overallRiskScore` у UI.

---

### 🔴 #3 — Race Condition з setTimeout у Agent Progress

**Файл:** `legal-council-ui-clean/src/app/(app)/review/page.tsx`

**Було:**
```javascript
// setTimeout'и працюють паралельно з fetch
setTimeout(() => updateAgentStatus('expert', 'completed', ...), 1000)
setTimeout(() => updateAgentStatus('provocateur', 'completed', ...), 2000)
const response = await fetch('/api/review', ...) // Race condition!
```

**Стало:**
```javascript
// Послідовний потік, прив'язаний до API lifecycle
updateAgentStatus('expert', 'running', ...)
const response = await fetch('/api/review', ...) // Чекаємо результат
updateAgentStatus('expert', 'completed', ...)

updateAgentStatus('provocateur', 'running', ...)
await new Promise(r => setTimeout(r, 300)) // Маленька затримка для UX
updateAgentStatus('provocateur', 'completed', ...)
// ... і так далі
```

Прогрес тепер:
1. Чекає реальну відповідь API перед позначенням Expert як completed
2. Послідовно оновлює агентів (не паралельно)
3. 300ms затримки між агентами — лише для UX (щоб користувач бачив перехід)
4. При помилці API — всі агенти коректно скидаються

---

### 🔴 #4 — Відсутня обробка Rate Limit помилок

**Файл:** `packages/legal-council/agents/base-agent.ts`

**Було:**
```typescript
// Don't retry on API errors (invalid key, rate limit, etc)
if (!isNetworkError) { throw error; }
```

**Стало:** Нова функція `isRetryableError()` яка перевіряє:
- ✅ Network errors (EAI_AGAIN, ENOTFOUND, ETIMEDOUT, ECONNRESET)
- ✅ HTTP 429 (Rate Limit) — для ВСІХ провайдерів
- ✅ HTTP 500, 503 (Server errors) — тимчасові серверні проблеми
- ✅ Anthropic `rate_limit_error` type
- ✅ OpenAI `rate_limit_exceeded` code
- ✅ Message-based detection ("overloaded", "Too Many Requests", etc.)

Окрема функція `isAuthError()` для помилок які НІКОЛИ не ретраяться (401, 403, invalid key).

Додано `getRetryDelay()` з:
- Exponential backoff з jitter
- Підтримка Retry-After header
- Cap на 30 секунд

---

### 🔴 #5 — API ключі з реальними префіксами в .env.example

**Файл:** `.env.example`

**Було:**
```
ANTHROPIC_API_KEY=sk-ant-api03-xxx
OPENAI_API_KEY=sk-xxx
GOOGLE_API_KEY=AIzaXXX
```

**Стало:**
```
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE
```

Також додано `NEXT_PUBLIC_API_URL` та `BACKEND_URL` для проксі-конфігурації (Issue #1).

---

### 🟠 #6 — Singleton клієнти LLM не thread-safe

**Файл:** `packages/legal-council/agents/base-agent.ts`

**Було:**
```typescript
let anthropicClient: Anthropic | null = null;  // Module-level singleton
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) { anthropicClient = new Anthropic({ apiKey }); }
  return anthropicClient; // Shared between requests!
}
```

**Стало:**
```typescript
// No module-level state
function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not found');
  return new Anthropic({ apiKey }); // Fresh instance per request
}
```

Клієнти тепер створюються per-request. В Next.js serverless functions це запобігає:
- Shared mutable state між concurrent requests
- Error state leaking від одного запиту до іншого
- Stale connection pooling

> **Примітка:** Накладні витрати на створення клієнта — мінімальні (~1ms), оскільки SDK клієнти лише зберігають конфігурацію, а HTTP з'єднання створюються при запиті.

---

### 🟠 #7 — Gemini API не використовує systemInstruction

**Файл:** `packages/legal-council/agents/base-agent.ts`, `callGoogle()`

**Було:**
```typescript
const model = client.getGenerativeModel({ model: this.config.model });
const fullPrompt = `${this.systemPrompt}\n\n${userPrompt}`;
const result = await model.generateContent(fullPrompt); // System + user mixed
```

**Стало:**
```typescript
const model = client.getGenerativeModel({
  model: this.config.model,
  systemInstruction: this.systemPrompt, // Proper system instruction
});
const result = await model.generateContent(userPrompt); // Only user content
```

Це дозволяє Gemini правильно розрізняти інструкції від контенту, що покращує якість юридичного аналізу.

---

### 🟠 #8 — Немає retry-логіки для Google Gemini

**Файл:** `packages/legal-council/agents/base-agent.ts`, `callGoogle()`

**Було:** Голий виклик API без try-catch, без retry. Network-помилки одразу крашали pipeline.

**Стало:** Повна retry-логіка як у callAnthropic() та callOpenAI():
- 3 спроби з exponential backoff + jitter
- Retryable: network errors, 429, 500, 503
- Non-retryable: auth errors (401, 403)
- Logging кожної спроби

Також виправлено token counting:
```typescript
// Було: грубе наближення (погане для кирилиці)
const estimatedInputTokens = Math.ceil(fullPrompt.length / 4);

// Стало: реальні значення від API
const usage = result.response.usageMetadata;
const inputTokens = usage?.promptTokenCount || Math.ceil(userPrompt.length / 3);
```

---

## Як застосувати

### Варіант 1: Копіювати файли
```bash
# З кореня проекту:
cp fixed-files/packages/legal-council/agents/base-agent.ts \
   packages/legal-council/agents/base-agent.ts

cp fixed-files/legal-council-ui-clean/src/app/\(app\)/review/page.tsx \
   legal-council-ui-clean/src/app/\(app\)/review/page.tsx

cp fixed-files/legal-council-ui-clean/src/app/api/review/route.ts \
   legal-council-ui-clean/src/app/api/review/route.ts

cp fixed-files/.env.example .env.example
```

### Варіант 2: Git diff
```bash
# Переглянути різницю перед застосуванням
diff -u packages/legal-council/agents/base-agent.ts \
       fixed-files/packages/legal-council/agents/base-agent.ts
```

### Налаштування після застосування

1. **Оновити `.env`** — якщо frontend та backend на різних портах:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

2. **Перебілдити:**
   ```bash
   npm run build
   ```

3. **Тестувати:**
   - Contract review через UI → повинен показувати реальні результати AI
   - Rate limit → повинен ретраїтись 3 рази перед помилкою
   - Network error → аналогічно

---

## Що залишилось (проблеми #9-24)

Див. повний список у `AGENTIS_BUGS_AND_IMPROVEMENTS.md`. Наступні за пріоритетом:
- #9: Token count estimation — частково виправлено в цьому патчі (Gemini)
- #10: AgentRole type дублювання
- #11: `as any` type casting
- #12: Timeout для API-запитів (AbortController)
- #13: JSON repair fallback
