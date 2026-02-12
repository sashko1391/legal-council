import { cn } from '@/shared/lib'
import type { AgentName, AgentStatus } from '@/shared/types'

interface AgentProgressProps {
  agents: {
    name: AgentName
    status: AgentStatus
    message?: string
  }[]
  className?: string
}

const AGENT_CONFIG = {
  expert: {
    label: 'Експерт',
    description: 'Аналізує відповідність ЦКУ, ГКУ, КЗпП',
    icon: '🔍',
  },
  provocateur: {
    label: 'Провокатор',
    description: 'Шукає слабкі місця та контраргументи',
    icon: '⚔️',
  },
  validator: {
    label: 'Валідатор',
    description: 'Перевіряє висновки та усуває суперечності',
    icon: '✓',
  },
  synthesizer: {
    label: 'Синтезатор',
    description: 'Формує фінальний звіт',
    icon: '📊',
  },
} as const

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-risk-safe border-risk-safe'
    case 'running':
      return 'bg-brand-primary border-brand-primary animate-pulse'
    case 'error':
      return 'bg-risk-critical border-risk-critical'
    default:
      return 'bg-muted border-gray-200'
  }
}

function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'running':
      return '⏳'
    case 'error':
      return '✗'
    default:
      return '⏸'
  }
}

export function AgentProgress({ agents, className }: AgentProgressProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {agents.map((agent) => {
        const config = AGENT_CONFIG[agent.name]
        const statusColor = getStatusColor(agent.status)
        const statusIcon = getStatusIcon(agent.status)

        return (
          <div
            key={agent.name}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3 transition-all',
              agent.status === 'running' && 'ring-2 ring-brand-primary/20',
              agent.status === 'completed' && 'bg-risk-safe/5'
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg',
                statusColor
              )}
            >
              {agent.status === 'running' ? statusIcon : config.icon}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {config.label}
                </h4>
                <span className="text-xs text-gray-500">
                  {agent.status === 'completed' && '✓ Завершено'}
                  {agent.status === 'running' && 'Аналізую...'}
                  {agent.status === 'pending' && 'Очікує'}
                  {agent.status === 'error' && 'Помилка'}
                </span>
              </div>

              <p className="text-xs text-gray-500">
                {agent.message || config.description}
              </p>

              {/* Progress bar for running agent */}
              {agent.status === 'running' && (
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-full animate-[shimmer_1s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-brand-primary to-transparent" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
