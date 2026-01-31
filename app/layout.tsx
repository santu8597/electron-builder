import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import "katex/dist/katex.min.css"
import "./globals.css"
import MathWrapper from "@/components/math-wrapper"

export const metadata: Metadata = {
  title: "PaperKraft - Professional Academic Tool",
  description:
    "Create, manage, and export professional question papers with drag-and-drop interface for educators and universities",
  generator: "v0.app",
  
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src 'self' blob: http://localhost:* ws://localhost:*;"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
          integrity="sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased">
        <Script
          src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"
          integrity="sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
          integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <MathWrapper>
          {children}
        </MathWrapper>
        <Analytics />
      </body>
    </html>
  )
}
