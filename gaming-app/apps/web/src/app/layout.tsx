import type { Metadata, Viewport } from 'next'
import { Inter, Orbitron, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import '@/styles/globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const orbitron = Orbitron({ 
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kaspa Rush - Ultimate Blockchain Gaming',
  description: 'Experience the most polished, provably fair multiplayer crash game on Kaspa blockchain. Ultra-fast, transparent, and addictively fun.',
  keywords: 'kaspa, blockchain, crash game, multiplayer, provably fair, crypto gaming',
  authors: [{ name: 'Kaspa Rush Team' }],
  openGraph: {
    title: 'Kaspa Rush - Ultimate Blockchain Gaming',
    description: 'Experience the most polished, provably fair multiplayer crash game',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kaspa Rush - Ultimate Blockchain Gaming',
    description: 'Experience the most polished, provably fair multiplayer crash game',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00D9FF',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
