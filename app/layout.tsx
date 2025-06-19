import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { DebugSettingsPanel } from "@/components/debug-settings-panel"
import { SettingsProvider } from "@/lib/contexts/settings-context"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Gemini AI Chatbot - Image Generation & Editing",
  description: "Advanced AI chatbot with image generation, editing, and intelligent conversation powered by Gemini AI",
  generator: 'v0.dev',
  keywords: ['AI chatbot', 'image generation', 'image editing', 'Gemini AI', 'GPT-Image-1', 'WaveSpeed'],
  authors: [{ name: 'AjWestfield' }],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Gemini AI Chatbot - Image Generation & Editing',
    description: 'Advanced AI chatbot with image generation, editing, and intelligent conversation powered by Gemini AI',
    url: 'https://github.com/AjWestfield/geminichatbot',
    siteName: 'Gemini AI Chatbot',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gemini AI Chatbot - Image Generation & Editing',
    description: 'Advanced AI chatbot with image generation, editing, and intelligent conversation powered by Gemini AI',
    creator: '@AjWestfield',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SettingsProvider>
            {children}
            <Toaster />
            <Sonner />
            <DebugSettingsPanel />
          </SettingsProvider>
        </ThemeProvider>
        {/* Debug script for image generation flow */}
        <script src="/debug-image-flow.js" defer></script>
      </body>
    </html>
  )
}
