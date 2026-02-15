'use client'

/**
 * Review Page — Contract Analysis with SSE Streaming + File Upload
 *
 * v5 changes (Feb 15, 2026):
 * - FIX: Правильне розпаковування даних з SSE (event.data.data, не event.data)
 * - FIX: PDF export URL виправлений на /api/export/pdf
 * - Redesign: Beautiful start screen (no empty SplitView)
 * - SplitView only appears during/after analysis
 * - Fuzzy deduplication of risks
 * - "Внести рекомендовані зміни" button
 * - Recommendations rendered separately from risks
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/shared/ui'
import { SplitView, RiskDashboard, FileUpload } from '@/shared/components'
import type { RiskSeverity } from '@/shared/types'

// ==========================================
// Types
// ==========================================

interface BackendCriticalRisk {
  title: string
  description: string
  impact: string
  mitigation: string
}

interface BackendRecommendation {
  priority: 'high' | 'medium' | 'low'
  action: string
  rationale: string
  specificLanguage?: string
}

interface BackendIssue {
  id: string
  severity: number
  title: string
  description: string
  legalBasis?: string
  recommendation?: string
  clauseReference?: string
  category?: string
}

interface ContractReviewResponse {
  summary: string
  overallRiskScore: number
  confidence: number
  criticalRisks: BackendCriticalRisk[]
  recommendations: BackendRecommendation[]
  detailedAnalysis: {
    expertAnalysis: {
      executiveSummary: string
      keyIssues: BackendIssue[]
      clauseAnalysis: any[]
      overallRiskScore: number
      recommendations: any[]
    }
    flawsFound: Array<{
      id: string
      severity: number
      issue: string
      clauseReference?: string
      exploitationScenario?: string
      suggestedFix?: string
    }>
    validationResults: any
  }
  metadata: {
    contractType: string
    jurisdiction?: string
    analyzedAt: string
    totalCost: number
    processingTimeMs: number
    failedAgents?: string[]
  }
}

interface AgentStatus {
  id: string
  name: string
  status: 'pending' | 'running' | 'done' | 'error'
  message: string
  durationMs?: number
}

const INITIAL_AGENTS: AgentStatus[] = [
  { id: 'expert', name: 'Експерт', status: 'pending', message: 'Очікує...' },
  { id: 'provocateur', name: 'Провокатор', status: 'pending', message: 'Очікує...' },
  { id: 'validator', name: 'Валідатор', status: 'pending', message: 'Очікує...' },
  { id: 'synthesizer', name: 'Синтезатор', status: 'pending', message: 'Очікує...' },
]

// ==========================================
// SSE Stream Reader
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
          const event = JSON.parse(currentData) as SSEEvent
          onEvent(event)
        } catch { /* ignore */ }
        currentData = ''
      }
    }
  }
}

// ==========================================
// Fuzzy deduplication
// ==========================================

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?'"«»""''—–\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSimilarTitle(a: string, b: string): boolean {
  const wordsA = new Set(normalizeForComparison(a).split(' ').filter(w => w.length > 2))
  const wordsB = new Set(normalizeForComparison(b).split(' ').filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return false
  let intersection = 0
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++
  }
  const union = new Set([...wordsA, ...wordsB]).size
  return (intersection / union) >= 0.5
}

function isDuplicate(risks: any[], title: string): boolean {
  return risks.some((r) => isSimilarTitle(r.title, title))
}

// ==========================================
// Map response → risks (deduplicated)
// ==========================================

function mapResponseToRisks(response: ContractReviewResponse): any[] {
  const risks: any[] = []
  let riskId = 1

  // 1. Synthesizer criticalRisks
  if (response.criticalRisks) {
    for (const cr of response.criticalRisks) {
      if (isDuplicate(risks, cr.title)) continue
      risks.push({
        id: String(riskId++),
        severity: 5 as RiskSeverity,
        title: cr.title,
        description: cr.description,
        recommendation: cr.mitigation,
        contractExcerpt: cr.impact,
        confidence: Math.round((response.confidence || 0.85) * 100),
        agentName: 'Синтезатор',
      })
    }
  }

  // 2. Expert keyIssues
  if (response.detailedAnalysis?.expertAnalysis?.keyIssues) {
    for (const issue of response.detailedAnalysis.expertAnalysis.keyIssues) {
      if (isDuplicate(risks, issue.title)) continue
      risks.push({
        id: String(riskId++),
        severity: Math.min(5, Math.max(1, issue.severity)) as RiskSeverity,
        title: issue.title,
        description: issue.description,
        legalCitation: issue.legalBasis,
        recommendation: issue.recommendation,
        contractExcerpt: issue.clauseReference,
        confidence: Math.round((response.confidence || 0.85) * 100),
        agentName: 'Експерт',
      })
    }
  }

  // 3. Provocateur flaws
  if (response.detailedAnalysis?.flawsFound) {
    for (const flaw of response.detailedAnalysis.flawsFound) {
      const flawTitle = flaw.issue || flaw.id
      if (isDuplicate(risks, flawTitle)) continue
      risks.push({
        id: String(riskId++),
        severity: Math.min(5, Math.max(1, flaw.severity)) as RiskSeverity,
        title: flawTitle,
        description: flaw.exploitationScenario || '',
        recommendation: flaw.suggestedFix,
        contractExcerpt: flaw.clauseReference,
        confidence: Math.round((response.confidence || 0.85) * 100),
        agentName: 'Провокатор',
      })
    }
  }

  return risks
}

// ==========================================
// Report downloads
// ==========================================

function downloadJSON(response: ContractReviewResponse | null, risks: any[]) {
  if (!response) return
  const report = {
    generatedAt: new Date().toISOString(),
    platform: 'AGENTIS',
    summary: response.summary,
    overallRiskScore: response.overallRiskScore,
    confidence: response.confidence,
    risks: risks.map((r) => ({
      severity: r.severity, title: r.title, description: r.description,
      recommendation: r.recommendation, legalCitation: r.legalCitation, agent: r.agentName,
    })),
    recommendations: response.recommendations,
    metadata: response.metadata,
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agentis-review-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * FIX: Виправлений URL для PDF export.
 * Було: /api/review/pdf (не існує)
 * Стало: бекенд /api/export/pdf з правильним body
 */
async function exportPDF(response: ContractReviewResponse | null, risks: any[]) {
  if (!response) return
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const pdfResponse = await fetch(`${backendUrl}/api/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'review',
        summary: response.summary,
        overallRiskScore: response.overallRiskScore,
        confidence: response.confidence,
        risks: risks.map((r) => ({
          severity: r.severity, title: r.title, description: r.description,
          recommendation: r.recommendation, legalCitation: r.legalCitation, agent: r.agentName,
        })),
        recommendations: response.recommendations,
        metadata: response.metadata,
      }),
    })
    if (pdfResponse.ok) {
      // Бекенд повертає HTML — відкриваємо у новій вкладці для друку
      const html = await pdfResponse.text()
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.onload = () => printWindow.print()
      } else {
        window.print()
      }
    } else {
      window.print()
    }
  } catch {
    window.print()
  }
}

// ==========================================
// Main Component
// ==========================================

export default function ReviewPage() {
  const router = useRouter()

  // State
  const [contractText, setContractText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentStatus[]>(INITIAL_AGENTS)
  const [summary, setSummary] = useState('')
  const [overallScore, setOverallScore] = useState(0)
  const [confidence, setConfidence] = useState(0)
  const [risks, setRisks] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<BackendRecommendation[]>([])
  const [rawResponse, setRawResponse] = useState<ContractReviewResponse | null>(null)
  const [processingTime, setProcessingTime] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // ==========================================
  // Derived state: which "screen" to show
  // ==========================================

  const isInputMode = !isLoading && !isComplete

  // ==========================================
  // Handlers
  // ==========================================

  const handleFileContent = useCallback((content: string, _filename: string) => {
    setContractText(content)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!contractText.trim()) return

    setIsLoading(true)
    setError(null)
    setAgents(INITIAL_AGENTS)
    setSummary('')
    setOverallScore(0)
    setConfidence(0)
    setRisks([])
    setRecommendations([])
    setRawResponse(null)
    setProcessingTime(0)
    setIsComplete(false)

    const startTime = Date.now()

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractText: contractText.trim() }),
      })

      if (!response.ok) throw new Error(`Помилка сервера: ${response.status}`)
      if (!response.body) throw new Error('SSE потік недоступний')

      await readSSEStream(response, (event) => {
        switch (event.type) {
          case 'agent_start':
            setAgents((prev) =>
              prev.map((a) =>
                a.id === event.agent
                  ? { ...a, status: 'running', message: event.message || 'Працює...' }
                  : a
              )
            )
            break
          case 'agent_complete':
            setAgents((prev) =>
              prev.map((a) =>
                a.id === event.agent
                  ? { ...a, status: 'done', message: event.message || 'Готово', durationMs: event.durationMs }
                  : a
              )
            )
            break
          case 'agent_error':
            setAgents((prev) =>
              prev.map((a) =>
                a.id === event.agent
                  ? { ...a, status: 'error', message: event.message || 'Помилка' }
                  : a
              )
            )
            break
          case 'result':
            /**
             * FIX: Бекенд обгортає результат у { success: true, data: <response> }.
             * SSE encoder серіалізує весь event, тому event.data = { success, data, metadata }.
             * Actual ContractReviewResponse знаходиться в event.data.data.
             *
             * Generate page робить це правильно (event.data?.data), review — ні. Тепер виправлено.
             */
            if (event.data?.data) {
              const data = event.data.data as ContractReviewResponse
              setRawResponse(data)
              setSummary(data.summary || '')
              setOverallScore(data.overallRiskScore || 0)
              setConfidence(Math.round((data.confidence || 0) * 100))
              setProcessingTime(Math.round((Date.now() - startTime) / 1000))
              setRisks(mapResponseToRisks(data))
              setRecommendations(data.recommendations || [])
              setIsComplete(true)
            } else if (event.data) {
              // Fallback: якщо бекенд змінить формат і надішле напряму
              const data = event.data as ContractReviewResponse
              if (data.summary || data.overallRiskScore !== undefined) {
                setRawResponse(data)
                setSummary(data.summary || '')
                setOverallScore(data.overallRiskScore || 0)
                setConfidence(Math.round((data.confidence || 0) * 100))
                setProcessingTime(Math.round((Date.now() - startTime) / 1000))
                setRisks(mapResponseToRisks(data))
                setRecommendations(data.recommendations || [])
                setIsComplete(true)
              }
            }
            break
          case 'error':
            setError(event.message || 'Невідома помилка')
            break
        }
      })
    } catch (err: any) {
      setError(err.message || 'Помилка аналізу')
    } finally {
      setIsLoading(false)
    }
  }, [contractText])

  const handleApplyRecommendations = useCallback(() => {
    if (!rawResponse || !contractText) return

    const allRecs: string[] = []
    if (rawResponse.recommendations) {
      for (const rec of rawResponse.recommendations) {
        let instruction = `[${rec.priority.toUpperCase()}] ${rec.action}`
        if (rec.specificLanguage) instruction += ` → Запропонований текст: "${rec.specificLanguage}"`
        allRecs.push(instruction)
      }
    }
    if (rawResponse.criticalRisks) {
      for (const cr of rawResponse.criticalRisks) {
        if (cr.mitigation && !allRecs.some(r => r.includes(cr.mitigation.slice(0, 30)))) {
          allRecs.push(`[CRITICAL] ${cr.mitigation}`)
        }
      }
    }

    const payload = {
      originalContract: contractText,
      contractType: rawResponse.metadata?.contractType || 'custom',
      recommendations: allRecs,
      summary: rawResponse.summary,
      riskScore: rawResponse.overallRiskScore,
    }

    try {
      sessionStorage.setItem('agentis_review_to_generate', JSON.stringify(payload))
      router.push('/generate?from=review')
    } catch {
      const text = `ОРИГІНАЛЬНИЙ ДОГОВІР:\n${contractText}\n\nРЕКОМЕНДАЦІЇ AGENTIS:\n${allRecs.join('\n')}`
      navigator.clipboard.writeText(text).then(() => {
        alert('Рекомендації скопійовано в буфер обміну.')
        router.push('/generate')
      })
    }
  }, [rawResponse, contractText, router])

  const handleReset = useCallback(() => {
    setContractText('')
    setIsLoading(false)
    setError(null)
    setAgents(INITIAL_AGENTS)
    setSummary('')
    setOverallScore(0)
    setConfidence(0)
    setRisks([])
    setRecommendations([])
    setRawResponse(null)
    setProcessingTime(0)
    setIsComplete(false)
  }, [])

  const handleRiskClick = (risk: any) => {
    console.log('Risk clicked:', risk)
  }

  const priorityLabel = (p: string) =>
    p === 'high' ? 'ВИСОКИЙ' : p === 'medium' ? 'СЕРЕДНІЙ' : 'НИЗЬКИЙ'

  const priorityColor = (p: string) =>
    p === 'high' ? 'bg-red-100 text-red-800' :
    p === 'medium' ? 'bg-yellow-100 text-yellow-800' :
    'bg-green-100 text-green-800'

  // ==========================================
  // RENDER: Input Mode — красива стартова
  // ==========================================

  if (isInputMode) {
    return (
      <div className="flex flex-col h-full">
        {/* Compact header */}
        <div className="border-b px-6 py-3">
          <h1 className="text-lg font-semibold">Аналіз контракту</h1>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">

            {/* Hero */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm text-blue-700 font-medium">
                <span>⚖️</span>
                4 AI-агенти • 207 законів • ~90 секунд
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Завантажте договір для аналізу
              </h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Система перевірить договір на ризики, прогалини та відповідність українському законодавству
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Upload zone */}
            <FileUpload onTextExtracted={handleFileContent} />

            {/* Textarea */}
            <div className="relative">
              <textarea
                className="w-full h-64 p-4 text-sm border border-gray-200 rounded-lg resize-none
                           focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                           placeholder:text-gray-400 transition-all"
                placeholder="Або вставте текст договору сюди..."
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
              />
              {contractText && (
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {contractText.length.toLocaleString()} символів
                  </span>
                  <button
                    onClick={() => setContractText('')}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Очистити
                  </button>
                </div>
              )}
            </div>

            {/* Analyze button */}
            <Button
              onClick={handleAnalyze}
              disabled={!contractText.trim()}
              className="w-full h-12 text-base font-semibold bg-blue-600 text-white
                         hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400
                         rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              {contractText.trim()
                ? '🔍 Аналізувати контракт'
                : 'Завантажте або вставте текст договору'}
            </Button>

            {/* Features */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { icon: '🔎', title: 'Експерт', desc: 'Повний аналіз ризиків' },
                { icon: '⚔️', title: 'Провокатор', desc: 'Пошук вразливостей' },
                { icon: '✓', title: 'Валідатор', desc: 'Перевірка повноти' },
                { icon: '📊', title: 'Синтезатор', desc: 'Підсумок та поради' },
              ].map((f) => (
                <div key={f.title} className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-xl mb-1">{f.icon}</div>
                  <div className="text-xs font-semibold text-gray-700">{f.title}</div>
                  <div className="text-xs text-gray-500">{f.desc}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: Analysis / Results Mode — SplitView
  // ==========================================

  return (
    <div className="flex flex-col h-full">
      {/* Header with actions */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Аналіз контракту</h1>
          {processingTime > 0 && (
            <span className="text-xs text-gray-500">
              {processingTime}с
              {overallScore > 0 && ` • Ризик: ${overallScore}/10`}
              {confidence > 0 && ` • Впевненість: ${confidence}%`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                ← Новий аналіз
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadJSON(rawResponse, risks)}
                disabled={!rawResponse}
              >
                📥 JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportPDF(rawResponse, risks)}
                disabled={!rawResponse}
              >
                📄 PDF
              </Button>
              {recommendations.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleApplyRecommendations}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  ✏️ Внести рекомендовані зміни
                </Button>
              )}
            </>
          )}
          {isLoading && !isComplete && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              ✕ Скасувати
            </Button>
          )}
        </div>
      </div>

      <SplitView
        leftContent={
          <div className="contract-text custom-scrollbar whitespace-pre-wrap p-4 text-sm">
            {contractText}
          </div>
        }
        rightContent={
          <div className="space-y-4 p-4">
            {/* Agent Progress */}
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
                            <span className="text-xs text-gray-400">
                              {(agent.durationMs / 1000).toFixed(1)}с
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{agent.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 p-4 text-red-800 text-sm">{error}</div>
            )}

            {/* Summary */}
            {summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📝 Резюме</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Risk Dashboard */}
            {risks.length > 0 && (
              <RiskDashboard
                risks={risks}
                onRiskClick={handleRiskClick}
              />
            )}

            {/* Recommendations — окрема секція */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">💡 Рекомендації</CardTitle>
                    <Button
                      size="sm"
                      onClick={handleApplyRecommendations}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      ✏️ Внести зміни
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.map((rec, idx) => (
                      <div key={idx} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${priorityColor(rec.priority)}`}>
                            {priorityLabel(rec.priority)}
                          </span>
                          <span className="text-sm font-medium">{rec.action}</span>
                        </div>
                        <p className="text-xs text-gray-600">{rec.rationale}</p>
                        {rec.specificLanguage && (
                          <div className="mt-1 rounded bg-blue-50 p-2 text-xs text-blue-800">
                            💡 {rec.specificLanguage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        }
      />
    </div>
  )
}
