"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import LeftPanel from "@/components/left-panel"
import RightPanel from "@/components/right-panel"
import { exportToWordWithPandoc } from "@/lib/export"

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
  const [pinataUrl, setPinataUrl] = useState<string | null>(null)

  useEffect(() => {
    // Get selected subject from localStorage
    const selectedSubjectData = localStorage.getItem("selectedSubject")
    if (selectedSubjectData) {
      try {
        const subject = JSON.parse(selectedSubjectData)
        if (subject.questionPaper?.pinataUrl) {
          setPinataUrl(subject.questionPaper.pinataUrl)
          setDraftTitle(subject.name || "Question Paper")
        }
      } catch (err) {
        console.error("Failed to parse subject data:", err)
      }
    }
  }, [])

  const handleExportWord = async () => {
    setIsExporting(true)
    try {
      const selectedIds = selectedQuestions.map(q => q.uniqueId || q.id)
      await exportToWordWithPandoc(draftTitle, paperSections, selectedIds)
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
          pinataUrl={pinataUrl}
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
