import { cn } from '@/shared/lib'
import type { RiskSeverity } from '@/shared/types'

interface RiskBadgeProps {
  severity: RiskSeverity
  className?: string
  showLabel?: boolean
  showIcon?: boolean
}

/**
 * Risk Severity Configuration
 * Based on AI consensus:
 * - ALL 3 AI said: Add icons (not just color!)
 * - DeepSeek: "Не тільки колір, а іконки"
 * - ChatGPT: "Use distinct icons (❗ ⚠️ ✓)"
 * - Grok: "Add patterns + text labels"
 */
const SEVERITY_CONFIG = {
  5: {
    label: 'Критичний',
    labelShort: 'Critical',
    color: 'bg-risk-critical text-white border-risk-critical',
    icon: '❗',
    description: 'Requires immediate attention',
  },
  4: {
    label: 'Високий',
    labelShort: 'High',
    color: 'bg-risk-high text-white border-risk-high',
    icon: '⚠️',
    description: 'Significant risk identified',
  },
  3: {
    label: 'Середній',
    labelShort: 'Medium',
    color: 'bg-risk-medium text-gray-900 border-risk-medium',
    icon: '⚙️',
    description: 'Moderate concern',
  },
  2: {
    label: 'Низький',
    labelShort: 'Low',
    color: 'bg-risk-low text-white border-risk-low',
    icon: '✓',
    description: 'Minor issue',
  },
  1: {
    label: 'Безпечно',
    labelShort: 'Safe',
    color: 'bg-risk-safe text-white border-risk-safe',
    icon: '✅',
    description: 'No issues found',
  },
} as const

export function RiskBadge({ 
  severity, 
  className,
  showLabel = true,
  showIcon = true, // AI consensus: ALWAYS show icon
}: RiskBadgeProps) {
  const config = SEVERITY_CONFIG[severity]

  return (
    <div
      className={cn(
        // Base styles (ChatGPT: border-radius 4-6px max)
        'risk-badge inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-semibold border transition-all duration-150',
        config.color,
        className
      )}
      title={config.description}
      role="status"
      aria-label={`Risk level: ${config.label}`}
    >
      {showIcon && <span className="text-sm" aria-hidden="true">{config.icon}</span>}
      {showLabel && <span>{config.label}</span>}
    </div>
  )
}

/**
 * Utility to get severity number from 0-10 risk score
 * (Unchanged from original)
 */
export function riskScoreToSeverity(score: number): RiskSeverity {
  if (score <= 2) return 1 // Safe
  if (score <= 4) return 2 // Low
  if (score <= 6) return 3 // Medium
  if (score <= 8) return 4 // High
  return 5 // Critical
}

/**
 * Get risk color for charts/visualizations
 */
export function getRiskColor(severity: RiskSeverity): string {
  const colors = {
    5: '#BE123C', // Critical (Deep Crimson - ChatGPT)
    4: '#D97706', // High (Reduced saturation)
    3: '#B8860B', // Medium (Darker yellow)
    2: '#15803D', // Low
    1: '#15803D', // Safe
  }
  return colors[severity]
}
