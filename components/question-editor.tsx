"use client"

import { useState, useEffect, useRef } from "react"
import type { ParsedQuestion } from "@/app/page"

interface QuestionEditorProps {
  question: ParsedQuestion
  onSave: (updates: Partial<ParsedQuestion>) => void
  onCancel: () => void
}

// Parse MCQ text into question stem and options
function parseMCQText(text: string): { stem: string; options: { label: string; text: string }[] } | null {
  if (!text) return null
  
  console.log('Parsing MCQ text:', text)
  
  // Check if text contains options pattern - handle HTML <p>(a) or plain \n(a)
  const hasOptions = /(?:<p>|[\n\s])\(([a-d])\)\s*/i.test(text)
  if (!hasOptions) {
    console.log('No options pattern found')
    return null
  }
  
  // Split by option pattern - handle <p>(a) or \n(a) or start with (a)
  const parts = text.split(/(?:<p>|(?:\n|^)\s*)\(([a-d])\)\s*/i)
  console.log('Split parts:', parts)
  
  const stem = parts[0].trim()
  const options: { label: string; text: string }[] = []
  
  // Parse options (array structure: stem, label1, text1, label2, text2, ...)
  for (let i = 1; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      // Remove closing </p> tags and trim
      let optionText = parts[i + 1].replace(/<\/p>/gi, '').trim()
      if (optionText) {
        options.push({
          label: parts[i].toLowerCase(),
          text: optionText
        })
      }
    }
  }
  
  console.log('Parsed MCQ:', { stem, options })
  
  // Only return if we found at least some options
  if (options.length === 0) {
    console.log('No options found after parsing')
    return null
  }
  
  return { stem, options }
}

// Reconstruct MCQ text from stem and options
function reconstructMCQText(stem: string, options: { label: string; text: string }[]): string {
  let text = stem
  for (const opt of options) {
    // Wrap in <p> tags to maintain HTML structure
    text += `\n<p>(${opt.label}) ${opt.text}</p>`
  }
  return text
}

export default function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [text, setText] = useState(question.text)
  const [marks, setMarks] = useState(question.marks)
  const [type, setType] = useState(question.type)
  const previewRef = useRef<HTMLDivElement>(null)
  
  // For MCQs, parse into stem and options - initialize properly
  const isMCQ = type === 'mcq'
  const initialMcqData = isMCQ ? parseMCQText(question.text) : null
  
  // Debug logging
  useEffect(() => {
    if (isMCQ) {
      console.log('MCQ Editor Debug:', {
        questionText: question.text,
        parsed: initialMcqData
      })
    }
  }, [])
  
  const [mcqStem, setMcqStem] = useState(() => {
    if (isMCQ && initialMcqData) {
      return initialMcqData.stem
    }
    // Fallback to original text for MCQs if parsing fails
    return isMCQ ? question.text : ''
  })
  
  const [mcqOptions, setMcqOptions] = useState(() => {
    if (isMCQ && initialMcqData?.options && initialMcqData.options.length > 0) {
      return initialMcqData.options
    }
    return [
      { label: 'a', text: '' },
      { label: 'b', text: '' },
      { label: 'c', text: '' },
      { label: 'd', text: '' }
    ]
  })
  
  // Update text when MCQ data changes
  useEffect(() => {
    if (isMCQ && mcqStem) {
      setText(reconstructMCQText(mcqStem, mcqOptions))
    }
  }, [mcqStem, mcqOptions, isMCQ])

  // Render math in preview whenever text changes
  useEffect(() => {
    if (previewRef.current && window.renderMathInElement) {
      previewRef.current.innerHTML = text
      window.renderMathInElement(previewRef.current, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
      })
    }
  }, [text])

  return (
    <div className="p-4 bg-white rounded border-2 border-primary space-y-3">
      {isMCQ ? (
        // MCQ Editor with separate inputs for stem and options
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Question Stem</label>
            <textarea
              value={mcqStem}
              onChange={(e) => setMcqStem(e.target.value)}
              className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary resize-none font-mono"
              rows={2}
              placeholder="Enter question text with LaTeX: $x^2$"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Options</label>
            <div className="space-y-2">
              {mcqOptions.map((opt, idx) => (
                <div key={opt.label} className="flex items-start gap-2">
                  <span className="text-sm font-semibold text-foreground bg-neutral-light px-2 py-1.5 rounded mt-0.5">
                    ({opt.label})
                  </span>
                  <textarea
                    value={opt.text}
                    onChange={(e) => {
                      const newOptions = [...mcqOptions]
                      newOptions[idx].text = e.target.value
                      setMcqOptions(newOptions)
                    }}
                    className="flex-1 text-sm p-2 border border-border rounded focus:outline-none focus:border-primary resize-none font-mono"
                    rows={1}
                    placeholder={`Option ${opt.label.toUpperCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Preview */}
          <div className="p-3 bg-neutral-lightest border border-border rounded">
            <div className="text-xs font-semibold text-neutral-gray mb-1">Preview:</div>
            <div 
              ref={previewRef}
              className="text-sm text-foreground min-h-[40px]"
            />
          </div>
        </div>
      ) : (
        // Regular editor for non-MCQ questions
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Question Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary resize-none font-mono"
            rows={3}
            placeholder="Enter question with LaTeX: $x^2$ or $$\frac{a}{b}$$"
          />
          
          {/* Preview */}
          <div className="mt-2 p-3 bg-neutral-lightest border border-border rounded">
            <div className="text-xs font-semibold text-neutral-gray mb-1">Preview:</div>
            <div 
              ref={previewRef}
              className="text-sm text-foreground min-h-[40px]"
            />
          </div>
        </div>
      )}

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
