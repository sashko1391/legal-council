import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, IBM_Plex_Serif } from 'next/font/google'
import { Header, Footer } from '@/shared/components'
import './globals.css'

// UI Font (Unanimous: Inter)
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

// Contract Font (DeepSeek: IBM Plex Serif for best Ukrainian Cyrillic)
const ibmPlexSerif = IBM_Plex_Serif({
  weight: ['400', '500', '600'],
  subsets: ['latin', 'cyrillic'],
  variable: '--font-ibm-plex-serif',
  display: 'swap',
})

// Code Font
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Legal Council - Юридичний Аналіз Контрактів',
  description: 'AI-powered аналіз юридичних договорів відповідно до законодавства України',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
