'use client'

/**
 * Generate Page — Document Generation with SSE Streaming
 *
 * v3 Complete redesign:
 * - SSE streaming for real-time agent progress
 * - Professional layout with document preview
 * - Quality metrics dashboard
 * - Multiple export formats (MD, PDF)
 * - Better clarification UX
 * - Skip blank handling
 */

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/shared/ui'

// ==========================================
// Types
// ==========================================

type DocumentType =
  | 'nda'
  | 'employment_agreement'
  | 'consulting_agreement'
  | 'lease_agreement'
  | 'sale_agreement'
  | 'service_agreement'
  | 'vendor_contract'
  | 'partnership_agreement'
  | 'amendment'
  | 'custom_clause'

type Stage = 'input' | 'loading' | 'clarification' | 'result'

interface AgentStatus {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'done' | 'error'
  message: string
  durationMs?: number
}

interface CompletedData {
  finalDocument: string
  metadata: {
    documentType: string
    generatedAt: string
    confidence: number
    totalCost: number
    processingTimeMs: number
  }
  summary: {
    executiveSummary: string
    keyTerms: { term: string; definition: string; importance: string }[]
    includedClauses: string[]
  }
  qualityMetrics: {
    complianceScore: number
    legalSoundness: number
    clarity: number
    overall: number
  }
  recommendations: {
    beforeSigning: string[]
    customizations: string[]
    reviewAreas: string[]
  }
}

// ==========================================
// Constants
// ==========================================

const DOCUMENT_TYPES: { value: DocumentType; label: string; icon: string; description: string }[] = [
  { value: 'lease_agreement', label: 'Договір оренди', icon: '🏢', description: 'Оренда приміщень, обладнання, транспорту' },
  { value: 'sale_agreement', label: 'Купівля-продаж', icon: '🤝', description: 'Купівля-продаж товарів, нерухомості' },
  { value: 'service_agreement', label: 'Договір послуг', icon: '⚙️', description: 'Надання послуг, консалтинг, аутсорсинг' },
  { value: 'employment_agreement', label: 'Трудовий договір', icon: '👤', description: 'Працевлаштування, умови праці' },
  { value: 'nda', label: 'NDA', icon: '🔒', description: 'Нерозголошення конфіденційної інформації' },
  { value: 'consulting_agreement', label: 'Консалтинг', icon: '💼', description: 'Консультаційні послуги' },
  { value: 'vendor_contract', label: 'Постачання', icon: '📦', description: 'Постачання товарів, матеріалів' },
  { value: 'partnership_agreement', label: 'Партнерство', icon: '🤲', description: 'Спільна діяльність, партнерство' },
  { value: 'amendment', label: 'Додаткова угода', icon: '📝', description: 'Зміни до існуючого договору' },
  { value: 'custom_clause', label: 'Окреме застереження', icon: '📋', description: 'Створення окремого пункту або умови' },
]

const INITIAL_AGENTS: AgentStatus[] = [
  { id: 'analyzer', name: 'Аналізатор', description: 'Аналіз вимог', status: 'pending', message: 'Очікує...' },
  { id: 'drafter', name: 'Укладач', description: 'Створення проекту', status: 'pending', message: 'Очікує...' },
  { id: 'gen-validator', name: 'Валідатор', description: 'Перевірка', status: 'pending', message: 'Очікує...' },
  { id: 'polisher', name: 'Редактор', description: 'Фінальне полірування', status: 'pending', message: 'Очікує...' },
]

// ==========================================
// SSE Stream Reader (same as review)
// ==========================================

interface SSEEvent {
  type: string
  agent?: string
  message?: string
  durationMs?: number
  data?: any
}

async function readSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    let currentData = ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        currentData = line.slice(6)
      } else if (line === '' && currentData) {
        try {
          onEvent(JSON.parse(currentData))
        } catch { /* ignore */ }
        currentData = ''
      }
    }
  }
}

// ==========================================
// Component
// ==========================================

export default function GeneratePage() {
  // Form
  const [documentType, setDocumentType] = useState<DocumentType>('service_agreement')
  const [requirements, setRequirements] = useState('')
  const [fromReview, setFromReview] = useState(false)
  const [reviewSummary, setReviewSummary] = useState('')

  // Flow
  const [stage, setStage] = useState<Stage>('input')
  const [error, setError] = useState<string | null>(null)

  // Clarification
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({})
  const [clarificationMessage, setClarificationMessage] = useState('')

  // Result
  const [result, setResult] = useState<CompletedData | null>(null)

  // Agents
  const [agents, setAgents] = useState<AgentStatus[]>(INITIAL_AGENTS)

  // ========================================
  // Load data from Review page (if from=review)
  // ========================================

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'review') return

    try {
      const stored = sessionStorage.getItem('agentis_review_to_generate')
      if (!stored) return

      const payload = JSON.parse(stored)
      sessionStorage.removeItem('agentis_review_to_generate')

      setFromReview(true)
      setReviewSummary(payload.summary || '')

      // Визначаємо тип документа з review
      const typeMap: Record<string, DocumentType> = {
        lease: 'lease_agreement',
        lease_agreement: 'lease_agreement',
        employment: 'employment_agreement',
        employment_agreement: 'employment_agreement',
        sale: 'sale_agreement',
        sale_agreement: 'sale_agreement',
        service: 'service_agreement',
        service_agreement: 'service_agreement',
        nda: 'nda',
        consulting: 'consulting_agreement',
        consulting_agreement: 'consulting_agreement',
        vendor: 'vendor_contract',
        vendor_contract: 'vendor_contract',
        partnership: 'partnership_agreement',
        partnership_agreement: 'partnership_agreement',
      }

      if (payload.contractType && typeMap[payload.contractType]) {
        setDocumentType(typeMap[payload.contractType])
      }

      // Формуємо requirements з оригіналу + рекомендації
      const parts: string[] = []
      parts.push('=== ОРИГІНАЛЬНИЙ ДОГОВІР (для внесення змін) ===')
      parts.push(payload.originalContract)
      parts.push('')
      parts.push('=== РЕКОМЕНДАЦІЇ AGENTIS ДЛЯ ВНЕСЕННЯ ЗМІН ===')
      if (payload.recommendations && payload.recommendations.length > 0) {
        for (const rec of payload.recommendations) {
          parts.push(`• ${rec}`)
        }
      }
      parts.push('')
      parts.push('ЗАВДАННЯ: Внести всі зазначені рекомендовані зміни до договору, зберігаючи його структуру. Створити оновлену версію договору з урахуванням всіх рекомендацій.')

      setRequirements(parts.join('\n'))
    } catch {
      // Ignore parse errors
    }
  }, [])

  const updateAgent = useCallback((agentId: string, status: AgentStatus['status'], message: string, durationMs?: number) => {
    setAgents((prev) =>
      prev.map((a) => a.id === agentId ? { ...a, status, message, durationMs } : a)
    )
  }, [])

  // ========================================
  // Submit — SSE streaming
  // ========================================

  const handleSubmit = useCallback(async (answers?: Record<string, string>) => {
    setError(null)
    setStage('loading')
    setAgents(INITIAL_AGENTS.map(a => ({ ...a, status: 'pending', message: 'Очікує...' })))

    try {
      const body: any = { documentType, requirements, jurisdiction: 'Україна' }
      if (answers && Object.keys(answers).length > 0) {
        body.clarificationAnswers = answers
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // Check for JSON error response
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const errData = await response.json()
        throw new Error(errData.error || `Помилка: ${response.status}`)
      }

      if (!response.body) throw new Error('Сервер не повернув потік даних')

      // Read SSE stream
      await readSSEStream(response, (event) => {
        switch (event.type) {
          case 'agent_start':
            if (event.agent) updateAgent(event.agent, 'running', event.message || 'Працює...')
            break

          case 'agent_complete':
            if (event.agent) updateAgent(event.agent, 'done', event.message || 'Готово', event.durationMs)
            break

          case 'agent_error':
            if (event.agent) updateAgent(event.agent, 'error', event.message || 'Помилка')
            break

          case 'gate_check':
            // Pre-Generation Gate: needs clarification
            if (event.data?.status === 'needs_clarification') {
              setClarificationQuestions(event.data.questions || [])
              setClarificationMessage(event.data.message || 'Потрібна додаткова інформація:')
              setClarificationAnswers({})
              setStage('clarification')
            }
            break

          case 'result':
            if (event.data?.data) {
              setResult(event.data.data)
              setStage('result')
            }
            break

          case 'error':
            setError(event.message || 'Помилка при генерації')
            setStage('input')
            break
        }
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Невідома помилка')
      setStage('input')
    }
  }, [documentType, requirements, updateAgent])

  // Clarification handlers
  const handleClarificationSubmit = useCallback(() => {
    const unanswered = clarificationQuestions.filter((_, i) => !clarificationAnswers[String(i)]?.trim())
    if (unanswered.length > 0) {
      setError('Будь ласка, дайте відповідь на всі питання або натисніть «Пропустити»')
      return
    }
    setError(null)
    handleSubmit(clarificationAnswers)
  }, [clarificationQuestions, clarificationAnswers, handleSubmit])

  const handleSkipClarification = useCallback(() => {
    const answers: Record<string, string> = { ...clarificationAnswers }
    clarificationQuestions.forEach((_, i) => {
      if (!answers[String(i)]?.trim()) answers[String(i)] = '_______'
    })
    setError(null)
    handleSubmit(answers)
  }, [clarificationQuestions, clarificationAnswers, handleSubmit])

  // Downloads
  const handleDownloadMD = useCallback(() => {
    if (!result?.finalDocument) return
    const blob = new Blob([result.finalDocument], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${documentType}_${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, documentType])

  const handleExportPDF = useCallback(async () => {
    if (!result) return
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const res = await fetch(`${backendUrl}/api/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'generation',
          documentText: result.finalDocument,
          documentType,
          qualityMetrics: result.qualityMetrics,
          summary: result.summary.executiveSummary,
          recommendations: result.recommendations.beforeSigning,
          metadata: result.metadata,
        }),
      })
      const html = await res.text()
      const win = window.open('', '_blank')
      if (win) { win.document.write(html); win.document.close() }
    } catch { alert('Помилка при експорті PDF') }
  }, [result, documentType])

  // Reset
  const handleReset = useCallback(() => {
    setStage('input')
    setResult(null)
    setError(null)
    setClarificationQuestions([])
    setClarificationAnswers({})
    setAgents(INITIAL_AGENTS)
  }, [])

  // ========================================
  // RENDER: Agent Progress Card (shared)
  // ========================================
  const AgentProgressCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">AI Агенти</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">
                {agent.status === 'done' ? '✅' :
                 agent.status === 'running' ? '🔄' :
                 agent.status === 'error' ? '⚠️' : '⏳'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{agent.name}</span>
                  {agent.durationMs && (
                    <span className="text-xs text-gray-400">{(agent.durationMs / 1000).toFixed(1)}с</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">{agent.message}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  // ========================================
  // RENDER: Input Stage
  // ========================================
  if (stage === 'input') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">✨ Генерація документів</h1>
          <p className="mt-1 text-gray-500">
            Опишіть що потрібно — система створить юридично коректний документ за ДСТУ 4163-2020
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-800 text-sm">{error}</div>
        )}

        {/* Banner: дані з аналізу */}
        {fromReview && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">📋</span>
              <div>
                <p className="font-medium text-blue-900">Дані завантажено з аналізу контракту</p>
                <p className="mt-1 text-sm text-blue-700">
                  Оригінальний договір та рекомендації AGENTIS вже заповнені нижче. Натисніть &quot;Генерувати&quot; для створення оновленої версії.
                </p>
                {reviewSummary && (
                  <p className="mt-2 text-xs text-blue-600 italic">{reviewSummary.slice(0, 200)}...</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Тип документа</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {DOCUMENT_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  onClick={() => setDocumentType(dt.value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    documentType === dt.value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{dt.icon}</span>
                    <span className="font-medium text-sm">{dt.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{dt.description}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Вимоги до документа</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder={`Опишіть ключові умови: сторони, предмет, строк, ціна, особливі вимоги...\n\nПриклад: Договір оренди офісного приміщення на вул. Хрещатик 10, Київ. Орендодавець — ТОВ "Альфа", орендар — ФОП Іванов. Площа 50 м², строк 2 роки, ціна 45 000 грн/міс з ПДВ.`}
              className="h-40 w-full rounded-md border border-gray-200 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="mt-2 flex justify-between text-xs text-gray-400">
              <span>Чим детальніше опишете — тим якісніший документ.</span>
              <span>{requirements.length} символів</span>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => handleSubmit()}
          disabled={!requirements.trim() || requirements.trim().length < 20}
          className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          size="lg"
        >
          🚀 Згенерувати документ
        </Button>
      </div>
    )
  }

  // ========================================
  // RENDER: Loading Stage
  // ========================================
  if (stage === 'loading') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">⏳ Генерація...</h1>
          <p className="text-gray-500">Працюють 4 AI-агенти. Зазвичай це займає 60–120 секунд.</p>
        </div>
        <AgentProgressCard />
      </div>
    )
  }

  // ========================================
  // RENDER: Clarification Stage
  // ========================================
  if (stage === 'clarification') {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">❓ Потрібна додаткова інформація</h1>
          <p className="mt-1 text-gray-500">{clarificationMessage}</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-800 text-sm">{error}</div>
        )}

        {/* Analyzer completed indicator */}
        <div className="flex items-center gap-2 text-sm text-green-700">
          <span>✅</span>
          <span>Аналізатор визначив структуру документа. Потрібні уточнення:</span>
        </div>

        <Card>
          <CardContent className="space-y-4 py-6">
            {clarificationQuestions.map((question, idx) => (
              <div key={idx} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {idx + 1}. {question}
                </label>
                <textarea
                  value={clarificationAnswers[String(idx)] || ''}
                  onChange={(e) =>
                    setClarificationAnswers((prev) => ({ ...prev, [String(idx)]: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  placeholder="Ваша відповідь..."
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={handleClarificationSubmit}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            size="lg"
          >
            ✅ Продовжити генерацію
          </Button>
          <Button onClick={handleSkipClarification} variant="outline" className="flex-1" size="lg">
            ⏭️ Пропустити — залишити _______
          </Button>
          <Button onClick={handleReset} variant="outline" size="lg">
            ← Назад
          </Button>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Якщо пропустити питання, у документі замість невідомих даних буде «_______» — заповніть пізніше вручну
        </p>
      </div>
    )
  }

  // ========================================
  // RENDER: Result Stage
  // ========================================
  if (stage === 'result' && result) {
    const metrics = result.qualityMetrics
    const meta = result.metadata
    const selectedType = DOCUMENT_TYPES.find(d => d.value === documentType)

    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">📄 Документ згенеровано</h1>
            <p className="mt-1 text-sm text-gray-500">
              {selectedType?.icon} {selectedType?.label} • {Math.round(meta.processingTimeMs / 1000)}с •
              Впевненість: {Math.round(meta.confidence * 100)}% •
              Вартість: ${meta.totalCost.toFixed(4)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownloadMD} variant="outline" size="sm">📥 .md</Button>
            <Button onClick={handleExportPDF} variant="outline" size="sm">📄 PDF</Button>
            <Button onClick={handleReset} variant="outline" size="sm">✨ Новий документ</Button>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Відповідність', value: metrics.complianceScore },
            { label: 'Юр. якість', value: metrics.legalSoundness },
            { label: 'Зрозумілість', value: metrics.clarity },
            { label: 'Загалом', value: metrics.overall },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="py-3 text-center">
                <div className={`text-2xl font-bold ${m.value >= 80 ? 'text-green-600' : m.value >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {m.value}%
                </div>
                <div className="text-xs text-gray-500">{m.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Document Text — 2/3 width */}
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Текст документа</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-6 font-serif text-sm leading-relaxed max-h-[600px] overflow-y-auto custom-scrollbar">
                  {result.finalDocument}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar — 1/3 width */}
          <div className="space-y-4">
            {/* Agent Progress */}
            <AgentProgressCard />

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Короткий зміст</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-700">{result.summary.executiveSummary}</p>
                {result.summary.includedClauses.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs font-medium text-gray-500">Включені розділи: </span>
                    <span className="text-xs text-gray-600">{result.summary.includedClauses.join(', ')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            {result.recommendations.beforeSigning.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">⚠️ Перед підписанням</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.recommendations.beforeSigning.map((rec, i) => (
                      <li key={i} className="flex gap-2 text-xs">
                        <span className="text-yellow-500 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Key Terms */}
            {result.summary.keyTerms.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Ключові терміни</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.summary.keyTerms.slice(0, 5).map((kt, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium">{kt.term}</span>
                        <span className="text-gray-500"> — {kt.definition}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
