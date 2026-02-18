"use client"

import { Download, FileText } from "lucide-react"

interface ExportMenuProps {
  onExportWord?: () => void
  onClose: () => void
}

export default function ExportMenu({ onExportWord, onClose }: ExportMenuProps) {
  return (
    <div className="absolute right-0 mt-2 w-48 bg-white border border-border rounded-lg shadow-lg z-50">

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
