"use client"

import { X } from "lucide-react"
import { useState } from "react"
import type { ParsedQuestion } from "@/app/page"

interface NewQuestionModalProps {
  onClose: () => void
  onAdd: (question: ParsedQuestion) => void
}

export default function NewQuestionModal({ onClose, onAdd }: NewQuestionModalProps) {
  const [text, setText] = useState("")
  const [marks, setMarks] = useState(1)
  const [type, setType] = useState<"short" | "long" | "mcq">("short")

  const handleSubmit = () => {
    if (!text.trim()) {
      alert("Please enter question text")
      return
    }

    const newQuestion: ParsedQuestion = {
      id: `q-${Date.now()}`,
      number: 0,
      text: text.trim(),
      marks,
      type,
    }

    onAdd(newQuestion)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Create New Question</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-light rounded transition-colors">
            <X className="w-5 h-5 text-neutral-gray" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Question Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your question here..."
              className="w-full text-sm p-3 border border-border rounded focus:outline-none focus:border-primary resize-none"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">Marks</label>
              <input
                type="number"
                value={marks}
                onChange={(e) => setMarks(Number.parseInt(e.target.value) || 0)}
                className="w-full text-sm p-3 border border-border rounded focus:outline-none focus:border-primary"
                min="0"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground block mb-2">Question Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full text-sm p-3 border border-border rounded focus:outline-none focus:border-primary"
              >
                <option value="short">Short Answer</option>
                <option value="long">Long Answer</option>
                <option value="mcq">Multiple Choice</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-border bg-neutral-lightest rounded-b-lg">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-white border border-border hover:bg-neutral-light rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded transition-colors"
          >
            Add Question
          </button>
        </div>
      </div>
    </div>
  )
}
