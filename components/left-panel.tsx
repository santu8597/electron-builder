"use client"

import type React from "react"

import { Upload, FileText, AlertCircle } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { parseDocxFile } from "@/lib/parser"
import type { Section, ParsedQuestion } from "@/app/page"
import QuestionCard from "./question-card"
import type { ParsedHeader } from "@/lib/header-parser"

interface LeftPanelProps {
  parsedContent: Section[]
  setParsedContent: (content: Section[]) => void
  setSelectedQuestions: (questions: ParsedQuestion[]) => void
  selectedQuestions?: ParsedQuestion[]
  paperSections?: Section[]
  setPaperSections?: (sections: Section[]) => void
  setParsedHeader?: (header: ParsedHeader | null) => void
}

export default function LeftPanel({ 
  parsedContent, 
  setParsedContent, 
  setSelectedQuestions,
  selectedQuestions = [],
  paperSections = [],
  setPaperSections,
  setParsedHeader
}: LeftPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadedFileName, setUploadedFileName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".docx")) {
      setError("Please upload a .docx file")
      return
    }

    setIsLoading(true)
    setError("")
    setUploadedFileName(file.name)

    try {
      const result = await parseDocxFile(file)
      console.log('📤 Left Panel - Received parsed result:', {
        sections: result.sections?.length,
        header: result.header
      })
      setParsedContent(result.sections)
      if (setParsedHeader) {
        console.log('📤 Setting parsedHeader in parent:', result.header)
        setParsedHeader(result.header)
      } else {
        console.log('⚠️ setParsedHeader function not provided')
      }
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document")
      setParsedContent([])
      setUploadedFileName("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add("drag-over")
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("drag-over")
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove("drag-over")

    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".docx")) {
      setIsLoading(true)
      setError("")
      setUploadedFileName(file.name)
      try {
        const result = await parseDocxFile(file)
        setParsedContent(result.sections)
        if (setParsedHeader) {
          setParsedHeader(result.header)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse document")
        setParsedContent([])
        setUploadedFileName("")
      } finally {
        setIsLoading(false)
      }
    } else {
      setError("Please drop a .docx file")
    }
  }

  const handleChangeFile = () => {
    setUploadedFileName("")
    setParsedContent([])
    setError("")
    fileInputRef.current?.click()
  }

  return (
    <div className="w-1/2 border-r border-border flex flex-col overflow-hidden bg-white">
      {/* Upload Section - Minimized when file is uploaded */}
      {parsedContent.length === 0 ? (
        <div className="p-6 border-b border-border bg-neutral-lightest">
          <h2 className="text-lg font-semibold text-foreground mb-4">Sample Question Paper</h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-neutral-gray mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Drop your .docx file here</p>
            <p className="text-xs text-neutral-gray">or click to browse</p>

            <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFileUpload} className="hidden" />
          </div>
        </div>
      ) : (
        <div className="px-6 py-3 border-b border-border bg-neutral-lightest flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            Editing File:
            <span className="text-sm font-medium text-foreground truncate">{uploadedFileName}</span>
          </div>
          <button
            onClick={handleChangeFile}
            className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors flex-shrink-0"
          >
            Change File
          </button>
          <input ref={fileInputRef} type="file" accept=".docx" onChange={handleFileUpload} className="hidden" />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
          <p className="text-sm text-accent-red">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-neutral-gray">Parsing document...</p>
          </div>
        </div>
      )}

      {/* Parsed Content */}
      {!isLoading && parsedContent.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Debug Info */}
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-xs">
              <strong>Debug Info:</strong>
              <div>Total Sections: {parsedContent.length}</div>
              {parsedContent.map((section, idx) => (
                <div key={idx} className="mt-1">
                  {section.title}: {section.questions.length} questions
                  {section.questions.length > 0 && (
                    <div className="ml-4 text-gray-600">
                      First Q text length: {section.questions[0].text?.length || 0} chars
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {parsedContent.map((section) => (
              <div key={section.id} className="border border-border rounded-lg bg-white shadow-sm overflow-hidden">
                {/* Section Header */}
                <div className="bg-primary/5 border-b border-border px-4 py-3">
                  {section.title && (
                    <h3 className="text-base font-bold text-primary uppercase tracking-wide">
                      {section.title}
                    </h3>
                  )}
                  {section.instructions && (
                    <p className="text-xs text-neutral-gray mt-2 italic">
                      {section.instructions}
                    </p>
                  )}
                  <div className="text-xs text-neutral-gray mt-1 font-medium">
                    {section.questions.length} {section.questions.length === 1 ? 'Question' : 'Questions'}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {section.questions.length === 0 ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                      ⚠️ No questions found in this section. Check console for debug logs.
                    </div>
                  ) : (
                    section.questions.map((question) => {
                      // Check if this question is already in any section on the right panel
                      const isSelected = paperSections.some(sec => 
                        sec.questions.some(q => q.uniqueId === question.uniqueId || q.id === question.id)
                      )
                      
                      return (
                        <QuestionCard 
                          key={question.id} 
                          question={question} 
                          isDraggable={true}
                          isSelected={isSelected}
                          onToggleSelect={(selected) => {
                            if (selected && setPaperSections) {
                              // Determine target section based on question type and group
                              let targetSectionId: string
                              let targetSectionTitle: string
                              
                              // Check if question is MCQ or Fill in the Blanks
                              const isMCQorFillBlanks = question.type === 'mcq' || 
                                                        section.title?.toLowerCase().includes('fill') ||
                                                        section.title?.toLowerCase().includes('blank')
                              
                              if (isMCQorFillBlanks) {
                                // All MCQs and Fill in the Blanks go to Group A regardless of module
                                targetSectionId = 'group-a'
                                targetSectionTitle = 'GROUP A - MCQs and Fill in the Blanks'
                              } else {
                                // Other questions maintain their original section structure
                                targetSectionId = section.id
                                targetSectionTitle = section.title
                              }
                              
                              const existingSection = paperSections.find(s => s.id === targetSectionId)
                              
                              if (existingSection) {
                                // Add to existing section
                                const updatedSections = paperSections.map(s => 
                                  s.id === targetSectionId
                                    ? { ...s, questions: [...s.questions, question] }
                                    : s
                                )
                                setPaperSections(updatedSections)
                              } else {
                                // Create new section
                                const newSection: Section = {
                                  id: targetSectionId,
                                  title: targetSectionTitle,
                                  instructions: isMCQorFillBlanks ? 'Answer all questions' : section.instructions,
                                  questions: [question]
                                }
                                setPaperSections([...paperSections, newSection])
                              }
                              
                              // Also update selectedQuestions
                              setSelectedQuestions([...selectedQuestions, question])
                            } else if (!selected && setPaperSections) {
                              // Remove question from right panel
                              const updatedSections = paperSections.map(sec => ({
                                ...sec,
                                questions: sec.questions.filter(q => 
                                  q.uniqueId !== question.uniqueId && q.id !== question.id
                                )
                              })).filter(sec => sec.questions.length > 0) // Remove empty sections
                              
                              setPaperSections(updatedSections)
                              
                              // Also update selectedQuestions
                              setSelectedQuestions(selectedQuestions.filter(q => 
                                q.uniqueId !== question.uniqueId && q.id !== question.id
                              ))
                            }
                          }}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && parsedContent.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-12 h-12 text-neutral-gray mx-auto mb-3 opacity-50" />
            <p className="text-sm text-neutral-gray mb-1">No document uploaded yet</p>
            <p className="text-xs text-neutral-gray">Upload a sample question paper to get started</p>
          </div>
        </div>
      )}
    </div>
  )
}
