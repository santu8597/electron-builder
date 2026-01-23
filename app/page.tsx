"use client"

import { useState } from "react"
import Header from "@/components/header"
import LeftPanel from "@/components/left-panel"
import RightPanel from "@/components/right-panel"
import { exportToPDFWithPandoc, exportToWordWithPandoc } from "@/lib/export"

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

export default function Home() {
  const [parsedContent, setParsedContent] = useState<Section[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<ParsedQuestion[]>([])
  const [paperSections, setPaperSections] = useState<Section[]>([])
  const [draftTitle, setDraftTitle] = useState("Question Paper")

  const handleExportPDF = async () => {
    try {
      await exportToPDFWithPandoc(draftTitle, paperSections)
    } catch (error: any) {
      alert(error.message || 'Failed to export to PDF')
    }
  }

  const handleExportWord = async () => {
    try {
      await exportToWordWithPandoc(draftTitle, paperSections)
    } catch (error: any) {
      alert(error.message || 'Failed to export to Word')
    }
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <Header 
        draftTitle={draftTitle} 
        setDraftTitle={setDraftTitle}
        onExportPDF={handleExportPDF}
        onExportWord={handleExportWord}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Document Parser */}
        <LeftPanel
          parsedContent={parsedContent}
          setParsedContent={setParsedContent}
          setSelectedQuestions={setSelectedQuestions}
        />

        {/* Right Panel - Question Paper Builder */}
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
