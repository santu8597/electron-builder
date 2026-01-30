"use client"

import type React from "react"

import { Trash2, ChevronDown } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import type { Section } from "@/app/page"
import QuestionEditor from "./question-editor"
import { showErrorDialog } from "@/lib/electron-api"

// Declare MathJax type
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
      typeset?: (elements?: HTMLElement[]) => void
    }
  }
}

interface SectionBuilderProps {
  section: Section
  allSections: Section[]
  setPaperSections: (sections: Section[]) => void
}

// Question limits for each group/subsection
const QUESTION_LIMITS = {
  'A-MCQ': 10,
  'A-FIB': 5,
  'B': 2,
  'C': 2,
  'D': 2,
  'E': 2
}

// Helper function to convert number to roman numerals
function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  
  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result.toLowerCase();
}

export default function SectionBuilder({ section, allSections, setPaperSections }: SectionBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  const sectionMarks = section.questions.reduce((sum, q) => sum + q.marks, 0)

  const handleDeleteSection = () => {
    setPaperSections(allSections.filter((s) => s.id !== section.id))
  }

  const handleDeleteQuestion = (questionId: string) => {
    const updatedSections = allSections.map((s) => {
      if (s.id === section.id) {
        return {
          ...s,
          questions: s.questions.filter((q) => q.id !== questionId),
        }
      }
      return s
    })
    setPaperSections(updatedSections)
  }

  const handleUpdateQuestion = (questionId: string, updates: any) => {
    const updatedSections = allSections.map((s) => {
      if (s.id === section.id) {
        return {
          ...s,
          questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
        }
      }
      return s
    })
    setPaperSections(updatedSections)
    setEditingQuestion(null)
  }

  const handleDropQuestion = (e: React.DragEvent) => {
    e.preventDefault()

    try {
      const data = e.dataTransfer.getData("application/json")
      const question = JSON.parse(data)

      // Extract group letter from section title (e.g., "Group A" -> "A")
      const sectionGroup = section.title.replace(/^Group\s+/i, '').trim()
      
      // Determine if this is an MCQ or Fill in Blanks question
      const isMCQorFillBlanks = question.type === 'mcq' || 
                                question.section?.toLowerCase().includes('fill') ||
                                question.section?.toLowerCase().includes('blank')
      
      // MCQs and Fill in Blanks should only go to Group A
      if (isMCQorFillBlanks && sectionGroup !== 'A') {
        showErrorDialog(
          'MCQs and Fill in the Blanks must go to Group A',
          'Please drag MCQ and Fill in the Blanks questions to Group A only.'
        )
        
        const element = e.currentTarget as HTMLElement
        element.style.backgroundColor = '#fee2e2'
        setTimeout(() => {
          element.style.backgroundColor = ''
        }, 500)
        return
      }
      
      // For non-MCQ questions, validate group matching
      if (!isMCQorFillBlanks) {
        const questionGroup = question.group || question.section?.replace(/^Group\s+/i, '').trim() || ''
        
        if (questionGroup && sectionGroup !== questionGroup) {
          showErrorDialog(
            `Cannot add Group ${questionGroup} question to ${section.title}`,
            'Please drag questions only to their respective groups.'
          )
          
          const element = e.currentTarget as HTMLElement
          element.style.backgroundColor = '#fee2e2'
          setTimeout(() => {
            element.style.backgroundColor = ''
          }, 500)
          console.warn(`Cannot add question from Group ${questionGroup} to Group ${sectionGroup}`)
          return
        }
      }

      // Check if question already exists in ANY group using uniqueId (prevent duplicates across all groups)
      const questionExists = allSections.some(s => 
        s.questions.some(q => q.uniqueId === question.uniqueId)
      )

      if (questionExists) {
        showErrorDialog(
          'Duplicate Question',
          'This question is already added to the paper.'
        )
        return
      }

      // Check question limits based on group and question type
      const isGroupA = sectionGroup === 'A'
      
      if (isGroupA) {
        // For Group A, check subsection limits
        const isMCQ = question.type === 'mcq'
        const isFillInBlanks = question.section?.includes('Fill in the Blanks') || question.section?.includes('FILL IN THE')
        
        const currentMCQs = section.questions.filter(q => q.type === 'mcq').length
        const currentFIBs = section.questions.filter(q => 
          q.section?.includes('Fill in the Blanks') || q.section?.includes('FILL IN THE')
        ).length
        
        if (isMCQ && currentMCQs >= QUESTION_LIMITS['A-MCQ']) {
          showErrorDialog(
            `Maximum ${QUESTION_LIMITS['A-MCQ']} MCQ Questions`,
            `Group A can only have up to ${QUESTION_LIMITS['A-MCQ']} MCQ questions.`
          )
          return
        }
        
        if (isFillInBlanks && currentFIBs >= QUESTION_LIMITS['A-FIB']) {
          showErrorDialog(
            `Maximum ${QUESTION_LIMITS['A-FIB']} Fill in the Blanks Questions`,
            `Group A can only have up to ${QUESTION_LIMITS['A-FIB']} Fill in the Blanks questions.`
          )
          return
        }
      } else {
        // For other groups (B, C, D, E), check overall limit
        const limit = QUESTION_LIMITS[sectionGroup as keyof typeof QUESTION_LIMITS]
        if (limit && section.questions.length >= limit) {
          showErrorDialog(
            `Maximum ${limit} Questions in Group ${sectionGroup}`,
            `Group ${sectionGroup} can only have up to ${limit} questions.`
          )
          return
        }
      }

      // Add to current section with new id but preserve uniqueId
      const updatedSections = allSections.map((s) => {
        if (s.id === section.id) {
          return {
            ...s,
            questions: [...s.questions, { ...question, id: `${question.uniqueId}-${Date.now()}` }],
          }
        }
        return s
      })
      setPaperSections(updatedSections)
    } catch (err) {
      console.error("Failed to parse dropped question", err)
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Section Header */}
      <div className="bg-white border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-neutral-light rounded transition-colors flex-shrink-0"
          >
            <ChevronDown
              className={`w-4 h-4 text-neutral-gray transition-transform ${!isExpanded ? "-rotate-90" : ""}`}
            />
          </button>

          <h3 className="flex-1 px-2 py-1 text-sm font-semibold text-foreground rounded">
            {section.title}
          </h3>

          <span className="text-xs font-medium text-neutral-gray whitespace-nowrap">
            {(() => {
              const sectionGroup = section.title.replace(/^Group\s+/i, '').trim()
              const limit = QUESTION_LIMITS[sectionGroup as keyof typeof QUESTION_LIMITS]
              const isGroupA = sectionGroup === 'A'
              
              if (isGroupA) {
                // For Group A, show total count
                return `${section.questions.length} Q · ${sectionMarks} marks`
              } else if (limit) {
                // For other groups, show count/limit
                return `${section.questions.length}/${limit} Q · ${sectionMarks} marks`
              }
              return `${section.questions.length} Q · ${sectionMarks} marks`
            })()}
          </span>
        </div>

        <button
          onClick={handleDeleteSection}
          className="p-2 text-neutral-gray hover:text-accent-red hover:bg-red-50 rounded transition-colors flex-shrink-0"
          title="Delete group"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Section Content */}
      {isExpanded && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add("drag-over")
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("drag-over")
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove("drag-over")
            handleDropQuestion(e)
          }}
          className="bg-neutral-lightest p-4 space-y-3 min-h-[100px]"
          ref={sectionRef}
        >
          {section.questions.length === 0 ? (
            <div className="text-center py-8 text-neutral-gray">
              <p className="text-sm">Drag {section.title} questions here</p>
              <p className="text-xs mt-1 opacity-70">
                {(() => {
                  const sectionGroup = section.title.replace(/^Group\s+/i, '').trim()
                  if (sectionGroup === 'A') {
                    return `Max: ${QUESTION_LIMITS['A-MCQ']} MCQs + ${QUESTION_LIMITS['A-FIB']} Fill in the Blanks`
                  }
                  const limit = QUESTION_LIMITS[sectionGroup as keyof typeof QUESTION_LIMITS]
                  return limit ? `Max ${limit} questions allowed` : 'Only questions from this group can be added'
                })()}
              </p>
            </div>
          ) : (
            <>
              {(() => {
                // Check if this is Group A and has subsections
                const isGroupA = section.title.match(/^Group\s+A/i)
                
                if (isGroupA) {
                  // Separate questions by type for Group A
                  const mcqQuestions = section.questions.filter(q => q.type === 'mcq')
                  const fillInBlanksQuestions = section.questions.filter(q => 
                    q.section?.includes('Fill in the Blanks') || q.section?.includes('FILL IN THE')
                  )
                  const otherQuestions = section.questions.filter(q => 
                    q.type !== 'mcq' && 
                    !q.section?.includes('Fill in the Blanks') && 
                    !q.section?.includes('FILL IN THE')
                  )

                  return (
                    <>
                      {/* MCQ Subsection */}
                      {mcqQuestions.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wide px-2 py-2 bg-primary/10 rounded">
                              Multiple Choice Questions
                            </h4>
                            <span className="text-xs text-neutral-gray font-medium">
                              {mcqQuestions.length} / {QUESTION_LIMITS['A-MCQ']}
                            </span>
                          </div>
                          {mcqQuestions.map((question, index) => (
                            <div key={question.id} className="mb-3">
                              {editingQuestion === question.id ? (
                                <QuestionEditor
                                  question={question}
                                  onSave={(updates) => handleUpdateQuestion(question.id, updates)}
                                  onCancel={() => setEditingQuestion(null)}
                                />
                              ) : (
                                <div className="flex items-start gap-3 p-3 bg-white rounded border border-border hover:shadow-sm transition-shadow group">
                                  <span className="text-xs font-semibold text-neutral-gray bg-neutral-light px-2 py-1 rounded flex-shrink-0 mt-0.5">
                                    {toRoman(index + 1)}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div 
                                      className="text-sm text-foreground prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: question.text }}
                                    />
                                    <div className="flex gap-2 mt-2 items-center">
                                      <span className="text-xs font-medium text-white bg-primary px-2 py-0.5 rounded">
                                        1 mark
                                      </span>
                                      <span className="text-xs text-neutral-gray capitalize bg-neutral-light px-2 py-0.5 rounded">
                                        mcq
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                      onClick={() => setEditingQuestion(question.id)}
                                      className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary-lighter rounded transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteQuestion(question.id)}
                                      className="px-2 py-1 text-xs font-medium text-accent-red hover:bg-red-50 rounded transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fill in the Blanks Subsection */}
                      {fillInBlanksQuestions.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wide px-2 py-2 bg-primary/10 rounded">
                              Fill in the Blanks
                            </h4>
                            <span className="text-xs text-neutral-gray font-medium">
                              {fillInBlanksQuestions.length} / {QUESTION_LIMITS['A-FIB']}
                            </span>
                          </div>
                          {fillInBlanksQuestions.map((question, index) => (
                            <div key={question.id} className="mb-3">
                              {editingQuestion === question.id ? (
                                <QuestionEditor
                                  question={question}
                                  onSave={(updates) => handleUpdateQuestion(question.id, updates)}
                                  onCancel={() => setEditingQuestion(null)}
                                />
                              ) : (
                                <div className="flex items-start gap-3 p-3 bg-white rounded border border-border hover:shadow-sm transition-shadow group">
                                  <span className="text-xs font-semibold text-neutral-gray bg-neutral-light px-2 py-1 rounded flex-shrink-0 mt-0.5">
                                    {index + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div 
                                      className="text-sm text-foreground prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: question.text }}
                                    />
                                    <div className="flex gap-2 mt-2 items-center">
                                      <span className="text-xs font-medium text-white bg-primary px-2 py-0.5 rounded">
                                        1 mark
                                      </span>
                                      <span className="text-xs text-neutral-gray capitalize bg-neutral-light px-2 py-0.5 rounded">
                                        short
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                      onClick={() => setEditingQuestion(question.id)}
                                      className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary-lighter rounded transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteQuestion(question.id)}
                                      className="px-2 py-1 text-xs font-medium text-accent-red hover:bg-red-50 rounded transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Other questions (if any) */}
                      {otherQuestions.map((question, index) => (
                        <div key={question.id} className="mb-3">
                          {editingQuestion === question.id ? (
                            <QuestionEditor
                              question={question}
                              onSave={(updates) => handleUpdateQuestion(question.id, updates)}
                              onCancel={() => setEditingQuestion(null)}
                            />
                          ) : (
                            <div className="flex items-start gap-3 p-3 bg-white rounded border border-border hover:shadow-sm transition-shadow group">
                              <span className="text-xs font-semibold text-neutral-gray bg-neutral-light px-2 py-1 rounded flex-shrink-0 mt-0.5">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="text-sm text-foreground prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: question.text }}
                                />
                                <div className="flex gap-2 mt-2 items-center">
                                  <span className="text-xs font-medium text-white bg-primary px-2 py-0.5 rounded">
                                    1 mark
                                  </span>
                                  <span className="text-xs text-neutral-gray capitalize bg-neutral-light px-2 py-0.5 rounded">
                                    short
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  onClick={() => setEditingQuestion(question.id)}
                                  className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary-lighter rounded transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  className="px-2 py-1 text-xs font-medium text-accent-red hover:bg-red-50 rounded transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )
                }

                // For other groups (B, C, D, E) - regular numbering
                return section.questions.map((question, index) => (
                  <div key={question.id} className="mb-3">
                    {editingQuestion === question.id ? (
                      <QuestionEditor
                        question={question}
                        onSave={(updates) => handleUpdateQuestion(question.id, updates)}
                        onCancel={() => setEditingQuestion(null)}
                      />
                    ) : (
                      <div className="flex items-start gap-3 p-3 bg-white rounded border border-border hover:shadow-sm transition-shadow group">
                        <span className="text-xs font-semibold text-neutral-gray bg-neutral-light px-2 py-1 rounded flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div 
                            className="text-sm text-foreground prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: question.text }}
                          />
                          <div className="flex gap-2 mt-2 items-center">
                            <span className="text-xs font-medium text-white bg-primary px-2 py-0.5 rounded">
                              12 marks
                            </span>
                            <span className="text-xs text-neutral-gray capitalize bg-neutral-light px-2 py-0.5 rounded">
                              long
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => setEditingQuestion(question.id)}
                            className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary-lighter rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="px-2 py-1 text-xs font-medium text-accent-red hover:bg-red-50 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
