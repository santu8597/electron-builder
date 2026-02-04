"use client"

import { Plus, Eye } from "lucide-react"
import { useState, useEffect } from "react"
import type { Section, ParsedQuestion } from "@/app/page"
import SectionBuilder from "./section-builder"
import NewQuestionModal from "./new-question-modal"
import PreviewModal from "./preview-modal"

interface RightPanelProps {
  selectedQuestions: ParsedQuestion[]
  setSelectedQuestions: (questions: ParsedQuestion[]) => void
  paperSections: Section[]
  setPaperSections: (sections: Section[]) => void
  draftTitle: string
}

const ALLOWED_GROUPS = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Extract all COs (Course Outcomes) from a question
 * A question can have multiple COs like CO1, CO2, CO3, CO4, CO5
 * Patterns supported:
 * - [(CO1)(Understand/LOCQ)]
 * - [(CO3, CO5)(Apply/IOCQ)]
 * - [(CO3,CO5)(Apply/IOCQ)] (no space)
 * - (CO1) or CO1
 * Returns array of ALL COs found (including duplicates across sub-questions)
 */
function extractAllCOsFromQuestion(question: ParsedQuestion): string[] {
  const cosFound: string[] = []
  
  // First check courseOutcome field
  if (question.courseOutcome) {
    const matches = question.courseOutcome.matchAll(/CO\s*[1-5]/gi)
    for (const match of matches) {
      const co = match[0].replace(/\s/g, '').toUpperCase()
      cosFound.push(co)
    }
  }
  
  // Parse from question text for various patterns
  if (question.text) {
    // Pattern 1: [(CO3, CO5)(Apply/IOCQ)] or [(CO3,CO5)(Apply/IOCQ)] - multiple COs with or without spaces
    const multiCoPattern = /\[\(CO\s*[1-5](?:\s*,\s*CO\s*[1-5])+\)\([^\]]*\)\]/gi
    const multiMatches = question.text.matchAll(multiCoPattern)
    for (const match of multiMatches) {
      // Extract all CO numbers from the matched pattern
      const coNumbers = match[0].matchAll(/CO\s*([1-5])/gi)
      for (const coMatch of coNumbers) {
        cosFound.push(`CO${coMatch[1]}`)
      }
    }
    
    // Pattern 2: [(CO1)(Understand/LOCQ)] - single CO (not already matched by Pattern 1)
    // This pattern should not match if it's part of a multi-CO pattern
    const singleCoPattern = /\[\(CO\s*([1-5])\)\([^\]]*\)\]/gi
    const singleMatches = question.text.matchAll(singleCoPattern)
    for (const match of singleMatches) {
      // Only add if this is truly a single CO pattern (not comma-separated)
      if (!match[0].includes(',')) {
        cosFound.push(`CO${match[1]}`)
      }
    }
    
    // Pattern 3: (CO1) - just parentheses (with or without space) - fallback
    if (cosFound.length === 0) {
      const parenPattern = /\(CO\s*([1-5])\)/gi
      const parenMatches = question.text.matchAll(parenPattern)
      for (const match of parenMatches) {
        cosFound.push(`CO${match[1]}`)
      }
    }
    
    // Pattern 4: CO1 - bare CO (only if not already found in other patterns)
    if (cosFound.length === 0) {
      const barePattern = /CO\s*([1-5])/gi
      const bareMatches = question.text.matchAll(barePattern)
      for (const match of bareMatches) {
        cosFound.push(`CO${match[1]}`)
      }
    }
  }
  
  // Return array with potential duplicates (important for sub-questions)
  return cosFound
}

export default function RightPanel({
  selectedQuestions,
  setSelectedQuestions,
  paperSections,
  setPaperSections,
  draftTitle,
}: RightPanelProps) {
  const [showNewQuestion, setShowNewQuestion] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [coCounts, setCoCounts] = useState<Record<string, number>>({
    CO1: 0,
    CO2: 0,
    CO3: 0,
    CO4: 0,
    CO5: 0
  })

  // Update CO counts whenever paperSections changes
  useEffect(() => {
    const counts: Record<string, number> = {
      CO1: 0,
      CO2: 0,
      CO3: 0,
      CO4: 0,
      CO5: 0
    }

    paperSections.forEach((section) => {
      section.questions.forEach((q) => {
        const cos = extractAllCOsFromQuestion(q)
        
        if (cos.length > 0) {
          // Count each CO found in the question
          cos.forEach(co => {
            if (counts[co] !== undefined) {
              counts[co] = counts[co] + 1
            }
          })
        }
      })
    })

    setCoCounts(counts)
  }, [paperSections])

  const totalMarks = paperSections.reduce((sum, section) => {
    return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
  }, 0)

  // Calculate total COs for percentage calculation
  const totalCOs = Object.values(coCounts).reduce((sum, count) => sum + count, 0)

  // Get available groups that haven't been used yet
  const availableGroups = ALLOWED_GROUPS.filter(
    (group) => !paperSections.some((section) => section.title === `Group ${group}`)
  )

  const handleAddGroup = () => {
    if (availableGroups.length === 0) return;
    
    const nextGroup = availableGroups[0]
    const newSection: Section = {
      id: `group-${nextGroup}-${Date.now()}`,
      title: `Group ${nextGroup}`,
      questions: [],
    }
    setPaperSections([...paperSections, newSection])
  }

  return (
    <div className="w-1/2 flex flex-col overflow-hidden bg-neutral-lightest">
      {/* Toolbar */}
      <div className="border-b border-border bg-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Question Paper Builder</h2>
            <p className="text-xs text-neutral-gray mt-1">
              {paperSections.length} of {ALLOWED_GROUPS.length} groups added
            </p>
          </div>
          
          {/* CO Counters */}
          <div className="flex items-center gap-3 pl-6 border-l border-border">
            {['CO1', 'CO2', 'CO3', 'CO4', 'CO5'].map(co => {
              const count = coCounts[co] || 0
              const percentage = totalCOs > 0 ? ((count / totalCOs) * 100).toFixed(1) : '0.0'
              return (
                <div key={co} className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-gray">{co}:</span>
                    <span className={`text-sm font-semibold ${count > 0 ? 'text-primary' : 'text-neutral-gray'}`}>
                      {count}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-gray">
                    {percentage}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-neutral-light hover:bg-border rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>

          <button
            onClick={() => setShowNewQuestion(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Question
          </button>
        </div>
      </div>

      {/* Marks Info */}
      <div className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
        <span className="text-sm text-neutral-gray">Total Marks</span>
        <span className={`text-lg font-semibold ${totalMarks > 0 ? "text-secondary" : "text-neutral-gray"}`}>
          {totalMarks}
        </span>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {paperSections.length > 0 ? (
          <>
            {paperSections.map((section) => (
              <SectionBuilder
                key={section.id}
                section={section}
                allSections={paperSections}
                setPaperSections={setPaperSections}
              />
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-neutral-gray mb-4">
              <svg className="w-16 h-16 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-4">Start building your question paper</p>
            <p className="text-xs text-neutral-gray mb-4">Add groups A through E</p>
            <button
              onClick={handleAddGroup}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-colors text-sm font-medium"
            >
              Add Group {availableGroups[0]}
            </button>
          </div>
        )}

        {paperSections.length > 0 && availableGroups.length > 0 && (
          <button
            onClick={handleAddGroup}
            className="w-full py-3 border-2 border-dashed border-border rounded-lg text-sm font-medium text-neutral-gray hover:border-primary hover:text-primary transition-colors"
          >
            + Add Group {availableGroups[0]}
          </button>
        )}
        
        {paperSections.length > 0 && availableGroups.length === 0 && (
          <div className="w-full py-3 text-center text-sm text-neutral-gray">
            All groups (A-E) have been added
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewQuestion && (
        <NewQuestionModal
          onClose={() => setShowNewQuestion(false)}
          onAdd={(question) => {
            // Add to first group or create new one
            if (paperSections.length === 0) {
              const firstGroup = ALLOWED_GROUPS[0]
              const newSection: Section = {
                id: `group-${firstGroup}-${Date.now()}`,
                title: `Group ${firstGroup}`,
                questions: [question],
              }
              setPaperSections([newSection])
            } else {
              const updatedSections = [...paperSections]
              updatedSections[0].questions.push(question)
              setPaperSections(updatedSections)
            }
            setShowNewQuestion(false)
          }}
        />
      )}

      {showPreview && (
        <PreviewModal title={draftTitle} sections={paperSections} onClose={() => setShowPreview(false)} />
      )}
    </div>
  )
}
