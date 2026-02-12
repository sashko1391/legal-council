'use client'

import { useState } from 'react'
import { cn } from '@/shared/lib'
import { RiskBadge } from './RiskBadge'
import type { RiskSeverity } from '@/shared/types'

interface RiskItem {
  id: string
  severity: RiskSeverity
  title: string
  description: string
  contractExcerpt?: string
  legalCitation?: string // e.g., "ЦКУ ст. 638"
  recommendation?: string
  confidence?: number // 0-100
  agentName?: string // Which agent found it
  lineNumber?: number // For "tether" animation
}

interface RiskDashboardProps {
  risks: RiskItem[]
  onRiskClick?: (risk: RiskItem) => void
  className?: string
}

/**
 * Hybrid Risk Dashboard
 * Based on ALL 3 AI consensus:
 * - DeepSeek: "Summary + detailed list"
 * - ChatGPT: "Risk Weather Map + Executive Summary"
 * - Grok: "Pie chart + accordion cards"
 * 
 * Structure:
 * 1. Top: Executive Summary (total risks, confidence, chart)
 * 2. Below: Accordion list sorted by severity
 * 3. Each card shows: icon, title, description, citation, confidence
 */
export function RiskDashboard({
  risks = [],
  onRiskClick,
  className,
}: RiskDashboardProps) {
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null)

  // Calculate stats
  const risksBySeverity = {
    5: risks.filter((r) => r.severity === 5).length,
    4: risks.filter((r) => r.severity === 4).length,
    3: risks.filter((r) => r.severity === 3).length,
    2: risks.filter((r) => r.severity === 2).length,
    1: risks.filter((r) => r.severity === 1).length,
  }

  const avgConfidence = risks.length
    ? Math.round(
        risks.reduce((sum, r) => sum + (r.confidence || 0), 0) / risks.length
      )
    : 0

  const handleRiskClick = (risk: RiskItem) => {
    setExpandedRiskId(expandedRiskId === risk.id ? null : risk.id)
    onRiskClick?.(risk)
  }

  // Sort risks by severity (critical first)
  const sortedRisks = [...risks].sort((a, b) => b.severity - a.severity)

  return (
    <div className={cn('space-y-md', className)}>
      {/* EXECUTIVE SUMMARY (ChatGPT: "Risk Weather Map") */}
      <div className="rounded-md border bg-white p-lg shadow-card">
        <h3 className="mb-md text-lg font-semibold">Огляд Ризиків</h3>

        <div className="grid gap-md md:grid-cols-3">
          {/* Total Risks */}
          <div className="text-center">
            <div className="mb-1 text-3xl font-bold text-navy">
              {risks.length}
            </div>
            <p className="text-sm text-gray-500">
              Всього знайдено проблем
            </p>
          </div>

          {/* Confidence Score */}
          <div className="text-center">
            <div className="mb-1 text-3xl font-bold text-navy">
              {avgConfidence}%
            </div>
            <p className="text-sm text-gray-500">
              Середня впевненість
            </p>
          </div>

          {/* Critical Count */}
          <div className="text-center">
            <div className="mb-1 text-3xl font-bold text-risk-critical">
              {risksBySeverity[5]}
            </div>
            <p className="text-sm text-gray-500">
              Критичних ризиків
            </p>
          </div>
        </div>

        {/* Horizontal bar chart (Grok recommendation) */}
        <div className="mt-md space-y-2">
          <p className="text-xs font-medium text-gray-500">
            Розподіл за рівнем:
          </p>
          <div className="space-y-1.5">
            {/* Critical */}
            {risksBySeverity[5] > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs w-20">Критичний</span>
                <div className="h-2 flex-1 rounded-sm bg-risk-critical/20">
                  <div
                    className="h-full rounded-sm bg-risk-critical transition-all"
                    style={{
                      width: `${(risksBySeverity[5] / risks.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs w-8 text-right text-gray-500">
                  {risksBySeverity[5]}
                </span>
              </div>
            )}

            {/* High */}
            {risksBySeverity[4] > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs w-20">Високий</span>
                <div className="h-2 flex-1 rounded-sm bg-risk-high/20">
                  <div
                    className="h-full rounded-sm bg-risk-high transition-all"
                    style={{
                      width: `${(risksBySeverity[4] / risks.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs w-8 text-right text-gray-500">
                  {risksBySeverity[4]}
                </span>
              </div>
            )}

            {/* Medium */}
            {risksBySeverity[3] > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs w-20">Середній</span>
                <div className="h-2 flex-1 rounded-sm bg-risk-medium/20">
                  <div
                    className="h-full rounded-sm bg-risk-medium transition-all"
                    style={{
                      width: `${(risksBySeverity[3] / risks.length) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs w-8 text-right text-gray-500">
                  {risksBySeverity[3]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED ACCORDION LIST (All 3 AI: sorted by severity) */}
      <div className="space-y-sm">
        <h3 className="text-lg font-semibold">Детальний Аналіз</h3>

        {sortedRisks.length === 0 ? (
          <div className="rounded-md border border-dashed bg-white p-lg text-center text-sm text-gray-500">
            Аналіз не завершений або ризики не знайдені
          </div>
        ) : (
          sortedRisks.map((risk) => {
            const isExpanded = expandedRiskId === risk.id

            return (
              <div
                key={risk.id}
                className={cn(
                  'group cursor-pointer rounded-md border bg-white transition-all duration-150',
                  'hover:shadow-md hover:border-brand-primary/30',
                  isExpanded && 'ring-2 ring-brand-primary/20 shadow-md'
                )}
                onClick={() => handleRiskClick(risk)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleRiskClick(risk)
                  }
                }}
              >
                {/* CARD HEADER (always visible) */}
                <div className="flex items-start gap-3 p-md">
                  {/* Risk Badge with icon (All 3 AI: MUST have icons!) */}
                  <div className="pt-0.5">
                    <RiskBadge severity={risk.severity} showLabel={false} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold leading-tight">
                        {risk.title}
                      </h4>
                      {risk.confidence && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {risk.confidence}% впевненість
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500">
                      {risk.description}
                    </p>

                    {/* Legal Citation (DeepSeek: "Inline legal reasoning") */}
                    {risk.legalCitation && (
                      <p className="text-xs font-medium text-navy">
                        📚 {risk.legalCitation}
                      </p>
                    )}
                  </div>

                  {/* Expand indicator */}
                  <div
                    className={cn(
                      'text-gray-500 transition-transform duration-150',
                      isExpanded && 'rotate-180'
                    )}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* EXPANDED CONTENT (DeepSeek: "Lawyers want explanations") */}
                {isExpanded && (
                  <div className="animate-slide-up space-y-sm border-t bg-gray-50 p-md">
                    {/* Contract Excerpt */}
                    {risk.contractExcerpt && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-gray-500">
                          Фрагмент договору:
                        </p>
                        <div className="rounded-sm border bg-white p-sm font-serif text-sm">
                          {risk.contractExcerpt}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    {risk.recommendation && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-gray-500">
                          Рекомендація:
                        </p>
                        <p className="text-sm">{risk.recommendation}</p>
                      </div>
                    )}

                    {/* Which agent found it */}
                    {risk.agentName && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Знайдено агентом:</span>
                        <span className="font-semibold">{risk.agentName}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
