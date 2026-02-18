"use client"

import { X } from "lucide-react"
import { useRef } from "react"
import type { Section } from "@/app/page"

// Declare MathJax type
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
      typeset?: (elements?: HTMLElement[]) => void
    }
  }
}

interface PreviewModalProps {
  title: string
  sections: Section[]
  onClose: () => void
}

export default function PreviewModal({ title, sections, onClose }: PreviewModalProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const totalMarks = sections.reduce((sum, section) => {
    return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
  }, 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-foreground">Preview</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-light rounded transition-colors">
            <X className="w-5 h-5 text-neutral-gray" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-neutral-lightest" ref={previewRef}>
          <div className="bg-white p-8 rounded-lg shadow-sm max-w-4xl mx-auto">
            {/* Title and Meta */}
            <div className="mb-8 pb-6 border-b-2 border-primary">
              <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
              <div className="flex items-center gap-6 text-sm text-neutral-gray">
                <span>
                  Total Marks: <strong className="text-foreground">{totalMarks}</strong>
                </span>
                <span>
                  Questions:{" "}
                  <strong className="text-foreground">
                    {sections.reduce((sum, s) => sum + s.questions.length, 0)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Sections */}
            {sections.map((section, sectionIndex) => (
              <div key={section.id} className="mb-8">
                <h2 className="text-xl font-bold text-primary mb-4 uppercase tracking-wide">{section.title}</h2>

                {section.instructions && (
                  <p className="text-sm text-neutral-gray bg-neutral-light p-3 rounded mb-4 italic">
                    {section.instructions}
                  </p>
                )}

                <div className="space-y-4">
                  {section.questions.map((question, qIndex) => (
                    <div key={question.id} className="mb-4">
                      <div className="flex gap-4">
                        <span className="font-semibold text-foreground flex-shrink-0">
                          {sectionIndex > 0 || qIndex > 0 ? sectionIndex + 1 : ""}.{qIndex + 1}
                        </span>
                        <div className="flex-1">
                          {question.text.includes('<') && question.text.includes('>') ? (
                            <div 
                              className="text-sm text-foreground mb-2 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: question.text }}
                            />
                          ) : (
                            <p className="text-sm text-foreground mb-2">{question.text}</p>
                          )}
                          <div className="text-xs text-neutral-gray">[{question.marks} marks]</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border bg-white">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-foreground bg-neutral-light hover:bg-border rounded transition-colors"
          >
            Close
          </button>
          
          
        </div>
      </div>
    </div>
  )
}
