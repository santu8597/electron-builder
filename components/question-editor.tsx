"use client"

import { useState } from "react"
import type { ParsedQuestion } from "@/app/page"

interface QuestionEditorProps {
  question: ParsedQuestion
  onSave: (updates: Partial<ParsedQuestion>) => void
  onCancel: () => void
}

export default function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [text, setText] = useState(question.text)
  const [marks, setMarks] = useState(question.marks)
  const [type, setType] = useState(question.type)

  return (
    <div className="p-4 bg-white rounded border-2 border-primary space-y-3">
      <div>
        <label className="text-xs font-semibold text-foreground block mb-1">Question Text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary resize-none"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Marks</label>
          <input
            type="number"
            value={marks}
            onChange={(e) => setMarks(Number.parseInt(e.target.value) || 0)}
            className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary"
            min="0"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary"
          >
            <option value="short">Short</option>
            <option value="long">Long</option>
            <option value="mcq">MCQ</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-foreground bg-neutral-light hover:bg-border rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ text, marks, type })}
          className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
