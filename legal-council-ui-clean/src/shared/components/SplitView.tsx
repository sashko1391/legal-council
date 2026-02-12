'use client'

import { useState } from 'react'
import { cn } from '@/shared/lib'

interface SplitViewProps {
  leftContent: React.ReactNode
  rightContent: React.ReactNode
  defaultSplit?: number // 0-100, default 50
  className?: string
}

/**
 * Split View Component
 * Based on UNANIMOUS consensus from all 3 AI experts:
 * - DeepSeek: "Юрист мислить порівнянням - text + analysis side by side"
 * - ChatGPT: "The Holy Grail of legal tech UI"
 * - Grok: "Left-right more efficient than up-down"
 * 
 * Specifications (from ChatGPT):
 * - 50/50 split adjustable via drag
 * - 24px padding around
 * - 16px gap between elements
 * - 1px solid slate-200 borders
 * - Sharp corners (not rounded bubbles!)
 */
export function SplitView({
  leftContent,
  rightContent,
  defaultSplit = 50,
  className,
}: SplitViewProps) {
  const [splitPosition, setSplitPosition] = useState(defaultSplit)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = () => {
    setIsDragging(true)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return

    const container = e.currentTarget.getBoundingClientRect()
    const position = ((e.clientX - container.left) / container.width) * 100
    
    // Constrain between 30% and 70% (don't let either side get too small)
    const constrainedPosition = Math.min(Math.max(position, 30), 70)
    setSplitPosition(constrainedPosition)
  }

  return (
    <div
      className={cn(
        'relative flex w-full select-none',
        'min-h-[600px] h-[calc(100vh-12rem)]',
        isDragging && 'cursor-col-resize',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* LEFT PANE - Contract Text */}
      <div
        className="relative overflow-y-auto border-r border-gray-200 bg-white"
        style={{ width: `${splitPosition}%` }}
      >
        <div className="p-lg">{leftContent}</div>
      </div>

      {/* DRAGGABLE DIVIDER (ChatGPT: "The Tether" concept) */}
      <div
        className={cn(
          'group relative z-10 w-1 cursor-col-resize bg-border transition-all duration-150 hover:w-1.5 hover:bg-brand-primary',
          isDragging && 'w-1.5 bg-brand-primary'
        )}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-label="Resize panels"
        aria-valuenow={splitPosition}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            setSplitPosition(Math.max(30, splitPosition - 5))
          } else if (e.key === 'ArrowRight') {
            setSplitPosition(Math.min(70, splitPosition + 5))
          }
        }}
      >
        {/* Visual indicator (shows on hover) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-16 w-6 items-center justify-center rounded-sm bg-brand-primary text-white shadow-md">
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
                d="M8 9l4-4 4 4m0 6l-4 4-4-4"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* RIGHT PANE - AI Insights */}
      <div
        className="relative overflow-y-auto bg-gray-50"
        style={{ width: `${100 - splitPosition}%` }}
      >
        <div className="p-lg">{rightContent}</div>
      </div>
    </div>
  )
}

/**
 * Quick Keyboard Shortcuts Info
 * (Grok: "j/k navigation, / for search")
 */
export function SplitViewKeyboardHelp() {
  return (
    <div className="rounded-sm border bg-white p-3 text-xs text-gray-500">
      <p className="mb-1 font-semibold">Клавіатурні команди:</p>
      <div className="grid grid-cols-2 gap-2">
        <div>← → Змінити розмір панелей</div>
        <div>j/k Наступний/попередній ризик</div>
        <div>/ Пошук</div>
        <div>Enter Розгорнути картку</div>
      </div>
    </div>
  )
}
