"use client"

import { useEffect, useRef } from "react"
import { GripVertical } from "lucide-react"
import type { ParsedQuestion } from "@/app/page"

interface QuestionCardProps {
  question: ParsedQuestion
  isDraggable?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

// Declare MathJax type
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
      typeset?: (elements?: HTMLElement[]) => void
    }
  }
}

// Enhanced table rendering component
function TableRenderer({ content }: { content: string }) {
  // Check if content is HTML table
  if (content.includes('<table')) {
    return (
      <div 
        className="my-4 overflow-x-auto bg-white border border-gray-200 rounded"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }
  
  // Handle pipe-separated tables (markdown style)
  if (content.includes('|') && content.split('\n').some(line => line.trim().startsWith('|'))) {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    const rows = lines.map(line => 
      line.split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim())
    )
    
    return (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 bg-white text-sm">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? "bg-gray-50" : "hover:bg-gray-50"}>
                {row.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex} 
                    className={`border border-gray-300 px-3 py-2 text-left ${
                      rowIndex === 0 ? "font-medium bg-gray-100" : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  
  return <div className="font-mono text-xs bg-gray-50 p-2 rounded my-2">{content}</div>
}

// Math content renderer
function MathRenderer({ content }: { content: string }) {
  // Handle MathML from pandoc
  if (content.includes('<math xmlns')) {
    return (
      <div 
        className="my-2 text-center"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }
  
  // Handle LaTeX-style math
  if (content.includes('$') || content.includes('\\(') || content.includes('\\[')) {
    return (
      <div className="my-2 p-2 bg-blue-50 rounded font-mono text-sm">
        {content}
      </div>
    )
  }
  
  // Fallback for [MATH] tags
  return (
    <div className="my-2 p-2 bg-blue-50 rounded font-mono text-sm">
      {content.replace(/\[MATH\]/g, '').replace(/\[\/MATH\]/g, '')}
    </div>
  )
}

export default function QuestionCard({ question, isDraggable = false, onEdit, onDelete }: QuestionCardProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Function to render content with proper HTML support
  function renderContent(text: string) {
    if (!text || text.trim() === '') {
      return <p className="text-neutral-gray italic">No content</p>
    }
    
    // Check if the text contains HTML tags (likely from pandoc conversion)
    if (text.includes('<') && text.includes('>')) {
      return (
        <div 
          className="prose prose-sm max-w-none question-html-content"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      )
    }
    
    // Split content into lines for processing plain text
    const lines = text.split('\n')
    
    return lines.map((line, index) => {
      // Handle table content
      if (line.startsWith('|') && line.endsWith('|') || 
          (line.includes('|') && lines.some(l => l.includes('|')))) {
        const tableContent = lines.filter(l => l.includes('|')).join('\n')
        return <TableRenderer key={`table-${index}`} content={tableContent} />
      }
      
      // Handle math content
      if (line.includes('[MATH]') || line.includes('$') || line.includes('<math')) {
        return <MathRenderer key={`math-${index}`} content={line} />
      }
      
      // Handle options (a), (b), (c), (d)
      if (line.match(/^\([a-d]\)/i)) {
        return (
          <p key={index} className="ml-4 mt-1">
            {line}
          </p>
        )
      }
      
      // Handle options a), b), c), d) without parentheses
      if (line.match(/^[a-d]\)/i)) {
        return (
          <p key={index} className="ml-4 mt-1">
            {line}
          </p>
        )
      }
      
      // Handle Roman numeral options
      if (line.match(/^\([ivxlcdm]+\)/i)) {
        return (
          <p key={index} className="ml-4 mt-1">
            {line}
          </p>
        )
      }
      
      // Handle regular content
      if (line.trim()) {
        return (
          <p key={index} className="mb-2">
            {line}
          </p>
        )
      }
      
      return null
    }).filter(Boolean)
  }

  return (
    <div
      draggable={isDraggable}
      className={`p-4 bg-white border border-border rounded-lg hover:shadow-md transition-shadow ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      onDragStart={(e) => {
        if (isDraggable) {
          e.dataTransfer.effectAllowed = "copy"
          e.dataTransfer.setData("application/json", JSON.stringify(question))
        }
      }}
    >
      <div className="flex gap-3">
        {isDraggable && <GripVertical className="w-5 h-5 text-neutral-gray flex-shrink-0 mt-0.5" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground mb-2">
                {question.displayNumber ? 
                  question.displayNumber : 
                  `Q${question.number}.`
                }
              </p>
              <div className="text-sm text-foreground leading-relaxed question-content" ref={contentRef}>
                {renderContent(question.text)}
              </div>
              {/* Display difficulty level information */}
              {(question.courseOutcome || question.bloomsLevel || question.questionType) && (
                <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                  <span className="font-semibold">Assessment Details: </span>
                  {question.courseOutcome && <span className="mr-2">({question.courseOutcome})</span>}
                  {question.bloomsLevel && <span className="mr-2">({question.bloomsLevel}</span>}
                  {question.questionType && <span>/{question.questionType})</span>}
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-white bg-primary px-2 py-1 rounded whitespace-nowrap flex-shrink-0">
              {question.marks} marks
            </span>
          </div>

          <div className="flex gap-2 text-xs text-neutral-gray">
            <span className="bg-neutral-light px-2 py-1 rounded capitalize">{question.type}</span>
          </div>
        </div>

        {!isDraggable && (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary-lighter rounded transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="px-2 py-1 text-xs font-medium text-accent-red hover:bg-red-50 rounded transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
