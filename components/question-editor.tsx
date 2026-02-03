"use client"

import { useState, useEffect } from "react"
import type { ParsedQuestion } from "@/app/page"

interface QuestionEditorProps {
  question: ParsedQuestion
  onSave: (updates: Partial<ParsedQuestion>) => void
  onCancel: () => void
}

// Parse HTML table into 2D array
function parseTable(html: string): string[][] | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  
  if (!table) return null
  
  const rows: string[][] = []
  const trs = table.querySelectorAll('tr')
  
  trs.forEach(tr => {
    const cells: string[] = []
    const tds = tr.querySelectorAll('td, th')
    tds.forEach(td => cells.push(td.innerHTML.trim()))
    if (cells.length > 0) rows.push(cells)
  })
  
  return rows.length > 0 ? rows : null
}

// Convert 2D array back to HTML table
function tableToHTML(data: string[][]): string {
  if (data.length === 0) return ''
  
  let html = '<table class="border-collapse border border-gray-300">\n'
  data.forEach((row, rowIdx) => {
    html += '  <tr>\n'
    row.forEach(cell => {
      const tag = rowIdx === 0 ? 'th' : 'td'
      html += `    <${tag} class="border border-gray-300 px-3 py-2">${cell}</${tag}>\n`
    })
    html += '  </tr>\n'
  })
  html += '</table>'
  
  return html
}

// Extract table from content and return content without table
function extractTable(html: string): { table: string | null; contentWithoutTable: string } {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)
  
  if (tableMatch) {
    return {
      table: tableMatch[0],
      contentWithoutTable: html.replace(tableMatch[0], '[TABLE_PLACEHOLDER]')
    }
  }
  
  return { table: null, contentWithoutTable: html }
}

// Parse MCQ text into question stem and options
function parseMCQText(text: string): { stem: string; options: { label: string; text: string }[] } | null {
  if (!text) return null
  
  // Check if text contains options pattern - handle HTML <p>(a) or plain \n(a)
  const hasOptions = /(?:<p>|[\n\s])\(([a-d])\)\s*/i.test(text)
  if (!hasOptions) {
    return null
  }
  
  // Split by option pattern - handle <p>(a) or \n(a) or start with (a)
  const parts = text.split(/(?:<p>|(?:\n|^)\s*)\(([a-d])\)\s*/i)
  
  const stem = parts[0].trim()
  const options: { label: string; text: string }[] = []
  
  // Parse options (array structure: stem, label1, text1, label2, text2, ...)
  for (let i = 1; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      // Remove closing </p> tags and trim
      let optionText = parts[i + 1].replace(/<\/p>/gi, '').trim()
      if (optionText) {
        options.push({
          label: parts[i].toLowerCase(),
          text: optionText
        })
      }
    }
  }
  
  // Only return if we found at least some options
  if (options.length === 0) {
    return null
  }
  
  return { stem, options }
}

// Reconstruct MCQ text from stem and options
function reconstructMCQText(stem: string, options: { label: string; text: string }[]): string {
  let text = stem
  for (const opt of options) {
    // Wrap in <p> tags to maintain HTML structure
    text += `\n<p>(${opt.label}) ${opt.text}</p>`
  }
  return text
}

export default function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [text, setText] = useState(question.text)
  const [marks, setMarks] = useState(question.marks)
  const [type, setType] = useState(question.type)
  
  // Extract table from question text
  const { table: extractedTable, contentWithoutTable } = extractTable(question.text)
  const [tableData, setTableData] = useState<string[][] | null>(() => {
    if (extractedTable) {
      return parseTable(extractedTable)
    }
    return null
  })
  const [mainContent, setMainContent] = useState(contentWithoutTable)
  
  // For MCQs, parse into stem and options - initialize properly
  const isMCQ = type === 'mcq'
  const initialMcqData = isMCQ ? parseMCQText(contentWithoutTable) : null
  
  const [mcqStem, setMcqStem] = useState(() => {
    if (isMCQ && initialMcqData) {
      return initialMcqData.stem
    }
    return isMCQ ? contentWithoutTable : ''
  })
  
  const [mcqOptions, setMcqOptions] = useState(() => {
    if (isMCQ && initialMcqData?.options && initialMcqData.options.length > 0) {
      return initialMcqData.options
    }
    return [
      { label: 'a', text: '' },
      { label: 'b', text: '' },
      { label: 'c', text: '' },
      { label: 'd', text: '' }
    ]
  })
  
  // Update text when MCQ data or table changes
  useEffect(() => {
    let updatedText = ''
    
    if (isMCQ && mcqStem) {
      updatedText = reconstructMCQText(mcqStem, mcqOptions)
    } else {
      updatedText = mainContent
    }
    
    // Re-insert table if it exists
    if (tableData) {
      updatedText = updatedText.replace('[TABLE_PLACEHOLDER]', tableToHTML(tableData))
    }
    
    setText(updatedText)
  }, [mcqStem, mcqOptions, isMCQ, tableData, mainContent])
  
  // Handle table cell changes
  const handleTableCellChange = (rowIdx: number, colIdx: number, value: string) => {
    if (!tableData) return
    const newData = tableData.map(row => [...row])
    newData[rowIdx][colIdx] = value
    setTableData(newData)
  }
  
  // Add row to table
  const addTableRow = () => {
    if (!tableData || tableData.length === 0) return
    const cols = tableData[0].length
    const newRow = Array(cols).fill('')
    setTableData([...tableData, newRow])
  }
  
  // Add column to table
  const addTableCol = () => {
    if (!tableData) return
    const newData = tableData.map(row => [...row, ''])
    setTableData(newData)
  }
  
  // Remove specific row
  const removeTableRow = (rowIdx: number) => {
    if (!tableData || tableData.length <= 1) return
    const newData = tableData.filter((_, idx) => idx !== rowIdx)
    setTableData(newData)
  }
  
  // Remove specific column
  const removeTableCol = (colIdx: number) => {
    if (!tableData || tableData[0].length <= 1) return
    const newData = tableData.map(row => row.filter((_, idx) => idx !== colIdx))
    setTableData(newData)
  }

  return (
    <div className="p-4 bg-white rounded border-2 border-primary space-y-3">
      {isMCQ && initialMcqData ? (
        // MCQ Editor with textareas
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Question Stem</label>
            <textarea
              value={mcqStem.replace(/<[^>]*>/g, '')}
              onChange={(e) => setMcqStem(e.target.value)}
              className="w-full text-sm p-3 border border-border rounded focus:outline-none focus:border-primary min-h-[60px] resize-y"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Options</label>
            <div className="space-y-2">
              {mcqOptions.map((opt, idx) => (
                <div key={opt.label} className="flex items-start gap-2">
                  <span className="text-sm font-semibold text-foreground bg-neutral-light px-2 py-2 rounded flex-shrink-0">
                    ({opt.label})
                  </span>
                  <textarea
                    value={opt.text.replace(/<[^>]*>/g, '')}
                    onChange={(e) => {
                      const newOptions = [...mcqOptions]
                      newOptions[idx].text = e.target.value
                      setMcqOptions(newOptions)
                    }}
                    className="flex-1 text-sm p-2 border border-border rounded focus:outline-none focus:border-primary min-h-[36px] resize-y"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Table Editor */}
          {tableData && (
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Table</label>
              <div className="overflow-x-auto border border-border rounded">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 p-0 w-8"></th>
                      {tableData[0].map((_, colIdx) => (
                        <th key={colIdx} className="border border-gray-300 bg-gray-100 p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeTableCol(colIdx)}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-1 rounded"
                            title="Delete column"
                          >
                            ×
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        <td className="border border-gray-300 bg-gray-100 p-0 text-center">
                          <button
                            type="button"
                            onClick={() => removeTableRow(rowIdx)}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-1 rounded w-full h-full"
                            title="Delete row"
                          >
                            ×
                          </button>
                        </td>
                        {row.map((cell, colIdx) => (
                          <td key={colIdx} className="border border-gray-300 p-0">
                            <input
                              type="text"
                              value={cell.replace(/<[^>]*>/g, '')}
                              onChange={(e) => handleTableCellChange(rowIdx, colIdx, e.target.value)}
                              className="w-full px-2 py-1 text-sm focus:outline-none focus:bg-blue-50 min-w-[80px]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={addTableRow} className="px-2 py-1 text-xs bg-neutral-light hover:bg-border rounded">+ Row</button>
                <button type="button" onClick={addTableCol} className="px-2 py-1 text-xs bg-neutral-light hover:bg-border rounded">+ Column</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Regular editor for non-MCQ questions
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">Question Text</label>
            <textarea
              value={mainContent.replace(/<[^>]*>/g, '')}
              onChange={(e) => setMainContent(e.target.value)}
              className="w-full text-sm p-3 border border-border rounded focus:outline-none focus:border-primary min-h-[80px] resize-y"
              rows={4}
            />
          </div>
          
          {/* Table Editor */}
          {tableData && (
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">Table</label>
              <div className="overflow-x-auto border border-border rounded">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 p-0 w-8"></th>
                      {tableData[0].map((_, colIdx) => (
                        <th key={colIdx} className="border border-gray-300 bg-gray-100 p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeTableCol(colIdx)}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-1 rounded"
                            title="Delete column"
                          >
                            ×
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        <td className="border border-gray-300 bg-gray-100 p-0 text-center">
                          <button
                            type="button"
                            onClick={() => removeTableRow(rowIdx)}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-1 rounded w-full h-full"
                            title="Delete row"
                          >
                            ×
                          </button>
                        </td>
                        {row.map((cell, colIdx) => (
                          <td key={colIdx} className="border border-gray-300 p-0">
                            <input
                              type="text"
                              value={cell.replace(/<[^>]*>/g, '')}
                              onChange={(e) => handleTableCellChange(rowIdx, colIdx, e.target.value)}
                              className="w-full px-2 py-1 text-sm focus:outline-none focus:bg-blue-50 min-w-[80px]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={addTableRow} className="px-2 py-1 text-xs bg-neutral-light hover:bg-border rounded">+ Row</button>
                <button type="button" onClick={addTableCol} className="px-2 py-1 text-xs bg-neutral-light hover:bg-border rounded">+ Column</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Marks</label>
          <input
            type="number"
            value={marks}
            onChange={(e) => setMarks(Number.parseInt(e.target.value) || 0)}
            className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary"
            min="0"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full text-sm p-2 border border-border rounded focus:outline-none focus:border-primary"
          >
            <option value="short">Short</option>
            <option value="long">Long</option>
            <option value="mcq">MCQ</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-foreground bg-neutral-light hover:bg-border rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ text, marks, type })}
          className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-light rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}
