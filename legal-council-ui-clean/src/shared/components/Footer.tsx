import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-6 py-8">
        {/* Top section */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* About */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">AGENTIS</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              AI-платформа для аналізу юридичних договорів відповідно до законодавства України
            </p>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Посилання</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/review" className="text-gray-600 hover:text-navy transition-colors">
                  Аналіз контракту
                </Link>
              </li>
              <li>
                <Link href="/history" className="text-gray-600 hover:text-navy transition-colors">
                  Історія аналізів
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Юридична інформація</h3>
            <ul className="space-y-2 text-sm">
              <li className="text-gray-600">
                Конфіденційність даних
              </li>
              <li className="text-gray-600">
                Умови використання
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom section */}
        <div className="mt-8 border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {currentYear} AGENTIS. AI-асистент, не юридична консультація.
          </p>
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Powered by Claude Opus 4.5, GPT-4o, Gemini 2.5</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
