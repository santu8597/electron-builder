"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import InstructionDialog from "@/components/instruction-dialog"
import { BookOpen, FileText, LogOut, User, Loader2 } from "lucide-react"

interface Subject {
  _id: string
  code: string
  name: string
  department: string
  createdAt: string
  updatedAt: string
  questionPaper?: {
    fileName: string
    fileType: string
    fileSize: number
    ipfsHash: string
    pinataUrl: string
  }
  syllabus?: {
    fileName: string
    fileType: string
    fileSize: number
    ipfsHash: string
    pinataUrl: string
  }
}

interface DashboardResponse {
  success: boolean
  moderator: {
    id: string
    name: string
    email: string
  }
  assignedSubjects: Subject[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [showInstructions, setShowInstructions] = useState(false)
  const [username, setUsername] = useState("")
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem("isAuthenticated")
    const token = localStorage.getItem("token")
    const moderatorData = localStorage.getItem("moderator")
    
    if (!isAuthenticated || !token) {
      router.push("/login")
      return
    }

    const moderator = moderatorData ? JSON.parse(moderatorData) : null
    setUsername(moderator?.name || "Admin")

    // Fetch dashboard data
    fetchDashboardData(moderator?.email, token)

    // Show instructions on first load
    const hasSeenInstructions = sessionStorage.getItem("hasSeenInstructions")
    if (!hasSeenInstructions) {
      setShowInstructions(true)
    }
  }, [router])

  const fetchDashboardData = async (email: string, token: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/dashboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          token,
        }),
      })

      const data: DashboardResponse = await response.json()

      if (response.ok && data.success) {
        setSubjects(data.assignedSubjects)
      } else {
        setError("Failed to load subjects")
      }
    } catch (err) {
      setError("An error occurred while fetching data")
      console.error("Dashboard fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }

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
    localStorage.removeItem("token")
    localStorage.removeItem("moderator")
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

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading subjects...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((subject) => (
                <Card key={subject._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-600" />
                        <Badge variant="outline">{subject.code}</Badge>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        {subject.department}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl mt-2">{subject.name}</CardTitle>
                    <CardDescription>
                      Assigned on: {new Date(subject.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      onClick={() => handleSetPaper(subject._id)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Set Question Paper
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {subjects.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Subjects Assigned</h3>
                <p className="text-gray-600">You don't have any subjects assigned for question paper setting.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
