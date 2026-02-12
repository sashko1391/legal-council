'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/shared/lib'
import { useUIStore } from '@/stores/ui'
import { Button } from '@/shared/ui'

const navigation = [
  {
    name: 'Огляд Контрактів',
    href: '/review',
    icon: '📋',
    module: 'review' as const,
  },
  {
    name: 'Історія',
    href: '/history',
    icon: '📂',
    module: 'history' as const,
  },
  {
    name: 'Генерація',
    href: '/generate',
    icon: '✨',
    module: 'generation' as const,
    disabled: true, // Coming soon
  },
  {
    name: 'Аналітика',
    href: '/analytics',
    icon: '📊',
    module: 'analytics' as const,
    disabled: true, // Coming soon
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r bg-white transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">⚖️</span>
              <span className="font-bold">Legal Council</span>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn(sidebarCollapsed && 'mx-auto')}
          >
            {sidebarCollapsed ? '→' : '←'}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.disabled ? '#' : item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-navy text-navy-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                  item.disabled && 'cursor-not-allowed opacity-50',
                  sidebarCollapsed && 'justify-center'
                )}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <span className="text-xl">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="flex-1">{item.name}</span>
                )}
                {!sidebarCollapsed && item.disabled && (
                  <span className="text-xs opacity-70">Скоро</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          {!sidebarCollapsed ? (
            <div className="space-y-1 text-xs text-gray-500">
              <p>v1.0.0</p>
              <p>© 2026 Legal Council</p>
            </div>
          ) : (
            <div className="text-center text-xs text-gray-500">
              v1.0
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
