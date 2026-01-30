"use client"

import { useEffect } from "react"

declare global {
  interface Window {
    renderMathInElement?: (element: HTMLElement, options: any) => void
    renderAllMath?: () => void
  }
}

export default function MathWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    
    // Create global render function
    window.renderAllMath = () => {
      if (window.renderMathInElement) {
        window.renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        })
      } else {
        console.warn('renderMathInElement not available')
      }
    }

    // Try to render with retries
    let attempts = 0
    const tryRender = () => {
      attempts++
      if (window.renderMathInElement) {
        window.renderAllMath()
      } else if (attempts < 50) {
        setTimeout(tryRender, 300)
      } else {
        console.error('Failed to load KaTeX after 50 attempts')
      }
    }
    
    tryRender()

    // Set up observer to auto-render on content changes
    let timeoutId: NodeJS.Timeout
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        window.renderAllMath?.()
      }, 300)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
    }
  }, [])

  return <>{children}</>
}
