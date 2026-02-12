'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { cn } from '@/shared/lib'

const NAV_LINKS = [
  { href: '/', label: 'Головна', icon: '🏠' },
  { href: '/review', label: 'Аналіз', icon: '🔍' },
  { href: '/history', label: 'Історія', icon: '📊' },
]

export function Header() {
  const pathname = usePathname()
  
  return (
    <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
        
        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || 
                            (link.href !== '/' && pathname.startsWith(link.href))
            
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-navy text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <span className="text-base">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
        
        {/* Right section - можна додати user menu пізніше */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            v1.0 Beta
          </div>
        </div>
      </div>
    </header>
  )
}
