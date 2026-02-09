// Export types for reuse across the application
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

export interface ParsedHeader {
  semesterLine: string
  subject: string
  code: string
  timeAllotted: string
  fullMarks: string
  note: string
}

export interface QuestionPaper {
  id: string
  title: string
  totalMarks: number
  sections: Section[]
  instructions?: string
  header?: ParsedHeader | null
}
