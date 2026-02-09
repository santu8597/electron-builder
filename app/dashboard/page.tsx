"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import InstructionDialog from "@/components/instruction-dialog"
import { FileText } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    // Show instructions on first load
    const hasSeenInstructions = sessionStorage.getItem("hasSeenInstructions")
    if (!hasSeenInstructions) {
      setShowInstructions(true)
    }
  }, [router])

  const handleInstructionsAccept = () => {
    setShowInstructions(false)
    sessionStorage.setItem("hasSeenInstructions", "true")
    // Navigate to question setter page
    router.push("/question-setter")
  }

  const handleInstructionsCancel = () => {
    // User cancelled, redirect to home
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <InstructionDialog 
        open={showInstructions} 
        onAccept={handleInstructionsAccept}
        onCancel={handleInstructionsCancel}
      />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-center items-center">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PaperKraft</h1>
                <p className="text-sm text-gray-600">Question Paper Management System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to PaperKraft</h2>
          <p className="text-gray-600 mb-8">Professional Question Paper Management System</p>
          <Button 
            size="lg"
            onClick={() => router.push("/question-setter")}
          >
            <FileText className="h-5 w-5 mr-2" />
            Start Creating Question Paper
          </Button>
        </div>
      </main>
    </div>
  )
}
