import Link from 'next/link'
import { Button } from '@/shared/ui'
import { RiskBadge } from '@/shared/components/RiskBadge'

/**
 * Landing Page - Legal Tech Hybrid Design
 * Based on consensus from DeepSeek, ChatGPT, Grok:
 * - Split hero layout (left: message, right: visual)
 * - Professional but not boring
 * - Trust signals prominent
 * - Navy blue brand color (#1E3A8A)
 */

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* HERO SECTION - Split Layout (All 3 AI recommended) */}
      <section className="container mx-auto px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* LEFT: Message (ChatGPT: "Punchy headline") */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-navy/10 px-4 py-2 text-sm font-medium text-navy">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-navy"></span>
                </span>
                AI-аналіз за 90 секунд
              </div>
              
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Юридичний Аналіз Контрактів
                <span className="block text-navy mt-2">
                  З Відповідністю ЦКУ, ГКУ, КЗпП
                </span>
              </h1>
              
              <p className="text-lg text-gray-500 leading-relaxed">
                Професійний AI-асистент для перевірки договорів. 
                4 спеціалізовані агенти аналізують кожен пункт та виявляють критичні ризики.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="text-base">
                <Link href="/review">
                  Проаналізувати Контракт →
                </Link>
              </Button>
              
              <Button asChild size="lg" variant="outline" className="text-base">
                <Link href="/history">
                  Переглянути Історію
                </Link>
              </Button>
            </div>

            {/* Trust indicators (All 3 AI: critical for lawyers) */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Відповідність законодавству</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Безпечна обробка даних</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Visual (ChatGPT: "Live mini-preview") */}
          <div className="relative">
            <div className="rounded-lg border bg-white p-6 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Результат Аналізу</h3>
                  <RiskBadge severity={4} />
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-md border border-risk-critical/20 bg-risk-critical/5 p-3">
                    <span className="text-lg">❗</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">Критичний ризик знайдено</p>
                      <p className="text-xs text-gray-500">
                        Відсутність ціни суперечить ЦКУ ст. 638
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 rounded-md border border-risk-medium/20 bg-risk-medium/5 p-3">
                    <span className="text-lg">⚙️</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">Середній ризик</p>
                      <p className="text-xs text-gray-500">
                        Нечіткі строки виконання
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 rounded-md border border-risk-safe/20 bg-risk-safe/5 p-3">
                    <span className="text-lg">✅</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">12 пунктів безпечні</p>
                      <p className="text-xs text-gray-500">
                        Відповідають стандартам
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating element */}
            <div className="absolute -bottom-4 -right-4 rounded-lg border bg-white p-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                    E
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-white">
                    P
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-risk-safe text-xs font-semibold text-white">
                    V
                  </div>
                </div>
                <div className="text-xs">
                  <p className="font-semibold">4 AI Агенти</p>
                  <p className="text-gray-500">Працюють разом</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION (Grok: 4-5 core features) */}
      <section className="border-t bg-white py-24">
        <div className="container mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold">Як Це Працює</h2>
            <p className="mt-4 text-lg text-gray-500">
              4 спеціалізовані AI-агенти аналізують ваш договір
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1 */}
            <div className="group hover-lift rounded-lg border bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-navy/10 text-2xl">
                🔍
              </div>
              <h3 className="mb-2 text-lg font-semibold">Експерт</h3>
              <p className="text-sm text-gray-500">
                Перевіряє відповідність ЦКУ, ГКУ, КЗпП. Знаходить юридичні неточності.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group hover-lift rounded-lg border bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-2xl">
                ⚔️
              </div>
              <h3 className="mb-2 text-lg font-semibold">Провокатор</h3>
              <p className="text-sm text-gray-500">
                Діє як опонент. Шукає слабкі місця та приховані ризики.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group hover-lift rounded-lg border bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-risk-safe/10 text-2xl">
                ✓
              </div>
              <h3 className="mb-2 text-lg font-semibold">Валідатор</h3>
              <p className="text-sm text-gray-500">
                Перевіряє висновки обох агентів. Усуває суперечності.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group hover-lift rounded-lg border bg-white p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-2xl">
                📊
              </div>
              <h3 className="mb-2 text-lg font-semibold">Синтезатор</h3>
              <p className="text-sm text-gray-500">
                Формує фінальний звіт з рекомендаціями та висновками.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST SECTION (All 3 AI: Critical for lawyers!) */}
      <section className="border-t py-16">
        <div className="container mx-auto px-6">
          <div className="rounded-lg border bg-white p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mb-4 text-4xl font-bold text-navy">95%+</div>
                <p className="text-sm text-gray-500">
                  Точність виявлення критичних ризиків
                </p>
              </div>
              
              <div className="text-center">
                <div className="mb-4 text-4xl font-bold text-navy">&lt;90s</div>
                <p className="text-sm text-gray-500">
                  Повний аналіз договору будь-якої складності
                </p>
              </div>
              
              <div className="text-center">
                <div className="mb-4 text-4xl font-bold text-navy">100%</div>
                <p className="text-sm text-gray-500">
                  Відповідність українському законодавству
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
