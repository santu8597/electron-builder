"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InstructionDialog from "@/components/instruction-dialog"
import { BookOpen, FileText, LogOut, User } from "lucide-react"

interface Subject {
  id: string
  name: string
  code: string
  semester: string
  assignedDate: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [showInstructions, setShowInstructions] = useState(false)
  const [username, setUsername] = useState("")
  const [subjects, setSubjects] = useState<Subject[]>([
    {
      id: "1",
      name: "Data Structures and Algorithms",
      code: "CS201",
      semester: "III",
      assignedDate: "2026-01-15"
    },
    {
      id: "2",
      name: "Database Management Systems",
      code: "CS301",
      semester: "V",
      assignedDate: "2026-01-20"
    },
    {
      id: "3",
      name: "Operating Systems",
      code: "CS302",
      semester: "V",
      assignedDate: "2026-01-22"
    },
    {
      id: "4",
      name: "Computer Networks",
      code: "CS401",
      semester: "VII",
      assignedDate: "2026-01-25"
    }
  ])

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem("isAuthenticated")
    const storedUsername = localStorage.getItem("username")
    
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    setUsername(storedUsername || "Admin")

    // Show instructions on first load
    const hasSeenInstructions = sessionStorage.getItem("hasSeenInstructions")
    if (!hasSeenInstructions) {
      setShowInstructions(true)
    }
  }, [router])

  const handleInstructionsAccept = () => {
    setShowInstructions(false)
    sessionStorage.setItem("hasSeenInstructions", "true")
  }

  const handleInstructionsCancel = () => {
    // User cancelled, log them out and return to login
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("username")
    router.push("/login")
  }

  const handleSetPaper = (subjectId: string) => {
    // Navigate to question setter page
    router.push("/question-setter")
  }

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("username")
    sessionStorage.removeItem("hasSeenInstructions")
    router.push("/login")
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
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PaperKraft Dashboard</h1>
                <p className="text-sm text-gray-600">Question Paper Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="h-4 w-4" />
                <span className="font-medium">{username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Assigned Subjects</h2>
          <p className="text-gray-600">Select a subject to start setting the question paper</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((subject) => (
            <Card key={subject.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <Badge variant="outline">{subject.code}</Badge>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                    Sem {subject.semester}
                  </Badge>
                </div>
                <CardTitle className="text-xl mt-2">{subject.name}</CardTitle>
                <CardDescription>
                  Assigned on: {new Date(subject.assignedDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  onClick={() => handleSetPaper(subject.id)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Set Question Paper
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {subjects.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subjects Assigned</h3>
            <p className="text-gray-600">You don't have any subjects assigned for question paper setting.</p>
          </div>
        )}
      </main>
    </div>
  )
}
