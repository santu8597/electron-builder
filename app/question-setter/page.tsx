"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import LeftPanel from "@/components/left-panel"
import RightPanel from "@/components/right-panel"
import { exportToPDFWithPandoc, exportToWordWithPandoc } from "@/lib/export"
import type { ParsedHeader } from "@/lib/header-parser"

// Declare MathJax type
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
      typeset?: (elements?: HTMLElement[]) => void
      startup?: {
        promise?: Promise<void>
      }
    }
  }
}

export interface ParsedQuestion {
  id: string
  uniqueId: string
  number: number
  text: string
  marks: number
  type: "short" | "long" | "mcq"
  section?: string
  group?: string
  displayNumber?: string
  marksDistribution?: string
  courseOutcome?: string
  bloomsLevel?: string
  questionType?: string
}

export interface Section {
  id: string
  title: string
  instructions?: string
  questions: ParsedQuestion[]
}

export interface QuestionPaper {
  id: string
  title: string
  totalMarks: number
  sections: Section[]
  instructions?: string
}

export default function QuestionSetterPage() {
  const router = useRouter()
  const [questionPaper, setQuestionPaper] = useState<QuestionPaper>({
    id: "paper-1",
    title: "Question Paper",
    totalMarks: 0,
    sections: [],
    instructions: "",
  })

  const [parsedContent, setParsedContent] = useState<Section[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<ParsedQuestion[]>([])
  const [paperSections, setPaperSections] = useState<Section[]>([])
  const [draftTitle, setDraftTitle] = useState("Question Paper")
  const [isExporting, setIsExporting] = useState(false)
  const [parsedHeader, setParsedHeader] = useState<ParsedHeader | null>(null)

  const handleExportPDF = async () => {
    setIsExporting(true)
    console.log('🚀 Export PDF - parsedHeader:', parsedHeader)
    if (parsedHeader) {
      console.log('✅ Using STRUCTURED HEADER')
      console.log('  - Semester:', parsedHeader.semesterLine)
      console.log('  - Subject:', parsedHeader.subject)
      console.log('  - Code:', parsedHeader.code)
      console.log('  - Time/Marks:', parsedHeader.timeAllotted, '/', parsedHeader.fullMarks)
    } else {
      console.log('⚠️ No header detected - using fallback')
    }
    try {
      const selectedIds = selectedQuestions.map(q => q.uniqueId || q.id)
      await exportToPDFWithPandoc(draftTitle, paperSections, selectedIds, parsedHeader)
    } catch (error) {
      console.error("Export to PDF failed:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportWord = async () => {
    setIsExporting(true)
    console.log('🚀 Export Word - parsedHeader:', parsedHeader)
    if (parsedHeader) {
      console.log('✅ Using STRUCTURED HEADER')
      console.log('  - Semester:', parsedHeader.semesterLine)
      console.log('  - Subject:', parsedHeader.subject)
      console.log('  - Code:', parsedHeader.code)
      console.log('  - Time/Marks:', parsedHeader.timeAllotted, '/', parsedHeader.fullMarks)
    } else {
      console.log('⚠️ No header detected - using fallback')
    }
    try {
      const selectedIds = selectedQuestions.map(q => q.uniqueId || q.id)
      await exportToWordWithPandoc(draftTitle, paperSections, selectedIds, parsedHeader)
    } catch (error) {
      console.error("Export to Word failed:", error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        draftTitle={draftTitle}
        setDraftTitle={setDraftTitle}
        onExportPDF={handleExportPDF}
        onExportWord={handleExportWord}
      />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          parsedContent={parsedContent}
          setParsedContent={setParsedContent}
          setSelectedQuestions={setSelectedQuestions}
          selectedQuestions={selectedQuestions}
          paperSections={paperSections}
          setPaperSections={setPaperSections}
          setParsedHeader={setParsedHeader}
        />
        <RightPanel 
          selectedQuestions={selectedQuestions}
          setSelectedQuestions={setSelectedQuestions}
          paperSections={paperSections}
          setPaperSections={setPaperSections}
          draftTitle={draftTitle}
        />
      </div>
    </div>
  )
}
