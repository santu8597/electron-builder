"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import LeftPanel from "@/components/left-panel"
import RightPanel from "@/components/right-panel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { exportToWordWithPandoc } from "@/lib/export"
import { BACKEND_API_URL } from "@/lib/variables"

// Declare MathJax type
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
      typeset?: (elements?: HTMLElement[]) => void
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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
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

  const handleUploadPaperClick = () => {
    if (isExporting) {
      return
    }

    setShowSubmitConfirm(true)
  }

  const handleConfirmUpload = async () => {
    setShowSubmitConfirm(false)
    setIsExporting(true)
    try {
      // Get subject ID from localStorage
      const selectedSubjectData = localStorage.getItem("selectedSubject")
      if (!selectedSubjectData) {
        alert("Subject information not found. Please go back to dashboard.")
        return
      }

      const subject = JSON.parse(selectedSubjectData)
      const subjectId = subject._id

      if (!subjectId) {
        alert("Subject ID not found. Please go back to dashboard.")
        return
      }

      // Generate Word document blob
      const selectedIds = selectedQuestions.map(q => q.uniqueId || q.id)
      const wordBlob = await exportToWordWithPandoc(draftTitle, paperSections, selectedIds, true)

      if (!wordBlob) {
        throw new Error("Failed to generate Word document")
      }

      // Create form data and upload directly to backend
      const formData = new FormData()
      const fileName = `${draftTitle.replace(/\s+/g, "_")}.docx`
      const wordFile = new File([wordBlob], fileName, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })
      formData.append("file", wordFile)
      formData.append("subjectId", subjectId)

      console.log("📤 Uploading to:", `${BACKEND_API_URL}/api/upload-mod-paper/${subjectId}`)

      // Upload directly to backend API
      const response = await fetch(`${BACKEND_API_URL}/api/upload-mod-paper/${subjectId}`, {
        method: "POST",
        body: formData,
        // Add any required headers (e.g., authorization)
        // headers: {
        //   'Authorization': `Bearer ${YOUR_AUTH_TOKEN}`
        // }
      })

      // Handle non-JSON responses
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("Non-JSON response:", text)
        throw new Error("Server returned an invalid response. Please check the backend API.")
      }

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || result.message || "Upload failed")
      }

      alert(`Question paper uploaded successfully!\nFile: ${fileName}\nSize: ${(wordBlob.size / 1024).toFixed(2)} KB`)
      router.push("/dashboard")
      console.log("✓ Upload success:", result)
    } catch (error) {
      console.error("Export and upload failed:", error)
      alert(`Failed to upload question paper: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        draftTitle={draftTitle}
        setDraftTitle={setDraftTitle}
        onExportWord={handleUploadPaperClick}
      />
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to submit the paper?</AlertDialogTitle>
            <AlertDialogDescription>
              After submitting, you will not be able to edit it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSubmitConfirm(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpload}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
