import type { Metadata, Viewport } from 'next'
import { Grandstander, Nunito } from 'next/font/google'
import './globals.css'

const display = Grandstander({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const body = Nunito({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Countdown',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#fff4e6',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
