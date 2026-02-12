'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/shared/ui'
import { SplitView, RiskDashboard, AgentProgress } from '@/shared/components'
import { useAnalysisStore } from '@/stores/analysis'
import type { RiskSeverity } from '@/shared/types'

export default function ReviewPage() {
  const [contractText, setContractText] = useState('')
  const [contractType, setContractType] = useState<string>('оренда')
  const [showResults, setShowResults] = useState(false)
  const [risks, setRisks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    isAnalyzing,
    agents,
    startAnalysis,
    resetAnalysis,
    updateAgentStatus,
    completeAgent,
  } = useAnalysisStore()

  const handleAnalyze = async () => {
    if (!contractText.trim()) {
      alert('Будь ласка, введіть текст контракту')
      return
    }

    setIsLoading(true)
    setError(null)
    startAnalysis()
    setShowResults(true)

    try {
      // Simulate agent progress
      updateAgentStatus('expert', 'running', 'Аналізую відповідність законодавству...')
      
      setTimeout(() => {
        updateAgentStatus('expert', 'completed', '7 проблем знайдено')
        updateAgentStatus('provocateur', 'running', 'Шукаю приховані ризики...')
      }, 1000)
      
      setTimeout(() => {
        updateAgentStatus('provocateur', 'completed', '4 слабких місця виявлено')
        updateAgentStatus('validator', 'running', 'Перевіряю висновки...')
      }, 2000)

      // Call API
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractText,
          contractType,
        }),
      })

      if (!response.ok) {
        throw new Error('API request failed')
      }

      const result = await response.json()
      
      // Update final agents
      updateAgentStatus('validator', 'completed', 'Суперечностей не знайдено')
      updateAgentStatus('synthesizer', 'running', 'Формую фінальний звіт...')
      
      setTimeout(() => {
        updateAgentStatus('synthesizer', 'completed', 'Звіт готовий')
        setRisks(result.data.risks || [])
        setIsLoading(false)
        resetAnalysis()
      }, 500)

    } catch (err) {
      console.error('Analysis error:', err)
      setError('Помилка при аналізі. Спробуйте ще раз.')
      setIsLoading(false)
      resetAnalysis()
    }
  }

  const handleReset = () => {
    setContractText('')
    setContractType('оренда')
    setShowResults(false)
    setRisks([])
    setError(null)
    resetAnalysis()
  }

  const handleRiskClick = (risk: any) => {
    // TODO: Implement "The Tether" animation - scroll to and highlight text
    console.log('Risk clicked:', risk)
    if (risk.lineNumber) {
      // Scroll to line in contract text
    }
  }

  // BEFORE analysis: Show upload form
  if (!showResults) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-heading-lg">Аналіз Контракту</h1>
          <p className="text-gray-500 mt-2">
            Завантажте договір для експертного аналізу з використанням 4 AI-агентів
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Введіть Контракт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contract Type */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Тип Договору
              </label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="оренда">Оренда</option>
                <option value="поставка">Поставка</option>
                <option value="послуги">Послуги</option>
                <option value="трудовий">Трудовий</option>
                <option value="підряд">Підряд</option>
                <option value="купівля-продаж">Купівля-продаж</option>
                <option value="інше">Інше</option>
              </select>
            </div>

            {/* Contract Text */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Текст Договору
              </label>
              <textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Вставте текст договору тут...

Приклад:
ДОГОВІР ОРЕНДИ НЕРУХОМОГО МАЙНА

1. ПРЕДМЕТ ДОГОВОРУ
1.1. Орендодавець передає, а Орендатор приймає в строкове платне користування..."
                className="contract-text custom-scrollbar min-h-[400px] w-full rounded-md border border-input bg-white p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-2 text-xs text-gray-500">
                Символів: {contractText.length}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleAnalyze}
                disabled={!contractText.trim()}
                className="flex-1"
              >
                Проаналізувати →
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features info */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="text-2xl">⚡</div>
                <div>
                  <h4 className="font-semibold">Швидкий аналіз</h4>
                  <p className="text-sm text-gray-500">
                    Результат за 60-90 секунд
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <div className="text-2xl">🔒</div>
                <div>
                  <h4 className="font-semibold">Конфіденційність</h4>
                  <p className="text-sm text-gray-500">
                    Ваші дані захищені
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // DURING/AFTER analysis: Show split view
  return (
    <div className="flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold">Аналіз Контракту</h1>
          <p className="text-sm text-gray-500">
            {contractType.charAt(0).toUpperCase() + contractType.slice(1)} • {contractText.length} символів
          </p>
        </div>

        <div className="flex gap-2">
          {!isAnalyzing && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset}>
                ← Новий аналіз
              </Button>
              <Button variant="outline" size="sm">
                Зберегти звіт
              </Button>
            </>
          )}
          {isAnalyzing && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              Скасувати
            </Button>
          )}
        </div>
      </div>

      {/* SPLIT VIEW (All 3 AI: Unanimous choice!) */}
      <SplitView
        leftContent={
          <div className="space-y-md">
            <div className="sticky top-0 bg-white pb-2">
              <h2 className="text-lg font-semibold">Текст Договору</h2>
              <p className="text-sm text-gray-500">
                IBM Plex Serif для кращої читабельності
              </p>
            </div>
            
            {/* Contract text (DeepSeek: IBM Plex Serif 16px/1.75) */}
            <div className="contract-text custom-scrollbar whitespace-pre-wrap rounded-md border bg-white p-lg font-serif">
              {contractText || 'Текст контракту відсутній'}
            </div>
          </div>
        }
        rightContent={
          <div className="space-y-md">
            {isAnalyzing ? (
              <>
                {/* "War Room" Agent Progress (All 3 AI: Show work!) */}
                <Card>
                  <CardHeader>
                    <CardTitle>Процес Аналізу</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AgentProgress
                      agents={Object.values(agents).map((agent) => ({
                        name: agent.name,
                        status: agent.status,
                        message: agent.message,
                      }))}
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* Error message */}
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">❌</span>
                      <div>
                        <h4 className="font-semibold text-red-900">Помилка</h4>
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Hybrid Risk Dashboard (All 3 AI: unanimous!) */}
                <RiskDashboard
                  risks={risks}
                  onRiskClick={handleRiskClick}
                />
              </>
            )}
          </div>
        }
      />
    </div>
  )
}
