"use client"

import { X } from "lucide-react"
import QuestionEditor from "./question-editor"
import type { ParsedQuestion } from "@/app/page"

interface EditQuestionModalProps {
  question: ParsedQuestion
  onSave: (updates: Partial<ParsedQuestion>) => void
  onClose: () => void
}

export default function EditQuestionModal({ question, onSave, onClose }: EditQuestionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Edit Question</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-light rounded transition-colors">
            <X className="w-5 h-5 text-neutral-gray" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <QuestionEditor
            question={question}
            onSave={onSave}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
