"use client"

import { Download, FileText } from "lucide-react"

interface ExportMenuProps {
  onExportPDF?: () => void
  onExportWord?: () => void
  onClose: () => void
}

export default function ExportMenu({ onExportPDF, onExportWord, onClose }: ExportMenuProps) {
  return (
    <div className="absolute right-0 mt-2 w-48 bg-white border border-border rounded-lg shadow-lg z-50">
      <button
        onClick={() => {
          onExportPDF?.()
          onClose()
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-neutral-light transition-colors border-b border-border"
      >
        <Download className="w-4 h-4 text-primary" />
        Export as PDF
      </button>

      <button
        onClick={() => {
          onExportWord?.()
          onClose()
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-neutral-light transition-colors"
      >
        <FileText className="w-4 h-4 text-secondary" />
        Export as Word
      </button>
    </div>
  )
}
