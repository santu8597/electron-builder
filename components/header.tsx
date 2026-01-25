"use client"

import { Save, Download, MoreVertical } from "lucide-react"
import { useState } from "react"
import ExportMenu from "./export-menu"

interface HeaderProps {
  draftTitle: string
  setDraftTitle: (title: string) => void
  onSaveDraft?: () => void
  onExportPDF?: () => void
  onExportWord?: () => void
}

export default function Header({ draftTitle, setDraftTitle, onSaveDraft, onExportPDF, onExportWord }: HeaderProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempTitle, setTempTitle] = useState(draftTitle)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      setDraftTitle(tempTitle)
      setIsEditing(false)
    }
  }

  return (
    <header className="bg-white border-b border-border">
      <div className="flex items-center justify-between h-20 px-8">
        {/* Logo and Title */}
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden">
            <img 
              src="/image.png" 
              alt="PaperKraft Logo" 
              className="w-full h-full object-contain"
            />
          </div>

          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
              className="text-xl font-semibold text-foreground bg-neutral-light px-3 py-1 rounded border border-border outline-none focus:border-primary"
            />
          ) : (
            <h1
              onClick={() => {
                setIsEditing(true)
                setTempTitle(draftTitle)
              }}
              className="text-xl font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
            >
              {draftTitle}
            </h1>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSaveDraft}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-neutral-light hover:bg-border rounded-lg transition-colors"
            title="Save current draft to browser"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-lg transition-colors"
              title="Export as PDF or Word"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {showExportMenu && (
              <ExportMenu
                onExportPDF={onExportPDF}
                onExportWord={onExportWord}
                onClose={() => setShowExportMenu(false)}
              />
            )}
          </div>

          <button
            className="p-2 text-foreground hover:bg-neutral-light rounded-lg transition-colors"
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
