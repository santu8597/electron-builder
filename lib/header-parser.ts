/**
 * Header Parser for Question Papers
 * Extracts and formats header information from Mammoth-generated HTML
 */

export interface ParsedHeader {
  semesterLine: string
  subject: string
  code?: string
  timeAllotted?: string
  fullMarks?: string
  note?: string
}

/**
 * Extract header information from raw HTML string
 * Looks for semester line, subject, code, time/marks, and notes
 */
export function parseQuestionPaperHeader(htmlContent: string): ParsedHeader | null {
  if (!htmlContent) return null

  // Remove HTML tags to get plain text for easier parsing
  const plainText = htmlContent.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim()
  const lines = plainText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  console.log('🔍 Header Parser - First 10 lines:', lines.slice(0, 10))

  if (lines.length < 3) {
    console.log('❌ Not enough lines for header parsing')
    return null
  }

  const header: Partial<ParsedHeader> = {}

  // Pattern 1: Detect semester line (e.g., B.TECH/CSE/6TH SEM/CSEN 3233/2024)
  const semesterPattern = /B\.TECH\/[A-Z]+\/\d+(?:TH|ST|ND|RD)?\s+SEM\/[A-Z]+\s*\d+\/\d{4}/i
  
  // Pattern 2: Detect subject name (all caps words)
  const subjectPattern = /^[A-Z][A-Z\s&]+$/
  
  // Pattern 3: Detect code line (e.g., (CSEN 3233))
  const codePattern = /^\([A-Z]+\s*\d+\)$/i
  
  // Pattern 4: Detect time and marks (e.g., Time Allotted : 2½ hrs Full Marks : 60)
  const timeMarksPattern = /Time\s*Allotted\s*:\s*(.*?)\s*Full\s*Marks\s*:\s*(\d+)/i
  
  // Pattern 5: Detect note line (e.g., "Figures out of the right margin...")
  const notePattern = /figures.*margin.*marks/i

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i]

    // Check for semester line
    if (!header.semesterLine && semesterPattern.test(line)) {
      header.semesterLine = line
      console.log('✅ Found semester line:', line)
      continue
    }

    // Check for subject name (must be all caps, typically 2-4 words)
    if (!header.subject && subjectPattern.test(line) && line.length > 5 && line.length < 50) {
      // Skip if it looks like a code line
      if (!codePattern.test(line)) {
        header.subject = line
        console.log('✅ Found subject:', line)
        continue
      }
    }

    // Check for code line
    if (!header.code && codePattern.test(line)) {
      header.code = line
      console.log('✅ Found code:', line)
      continue
    }

    // Check for time and marks line
    if (!header.timeAllotted && !header.fullMarks) {
      const timeMarksMatch = line.match(timeMarksPattern)
      if (timeMarksMatch) {
        header.timeAllotted = timeMarksMatch[1].trim()
        header.fullMarks = timeMarksMatch[2].trim()
        console.log('✅ Found time/marks:', header.timeAllotted, '/', header.fullMarks)
        continue
      }
    }

    // Check for note line
    if (!header.note && notePattern.test(line.toLowerCase())) {
      header.note = line
      console.log('✅ Found note:', line)
      continue
    }
  }

  console.log('📋 Parsed header fields:', header)

  // Validate that we have at least the essential fields
  if (!header.semesterLine || !header.subject) {
    console.log('❌ Missing required fields. semesterLine:', !!header.semesterLine, 'subject:', !!header.subject)
    return null
  }

  console.log('✅ Header parsing successful!')
  return header as ParsedHeader
}

/**
 * Generate structured HTML header from parsed data
 */
export function generateHeaderHTML(header: ParsedHeader): string {
  return `<header class="paper-header">
  <div class="line-1">${header.semesterLine}</div>

  <div class="title">
    <div class="subject">${header.subject}</div>
    ${header.code ? `<div class="code">${header.code}</div>` : ''}
  </div>

  ${header.timeAllotted && header.fullMarks ? `<div class="meta-row">
    <span>Time Allotted : ${header.timeAllotted}</span>
    <span>Full Marks : ${header.fullMarks}</span>
  </div>` : ''}

  ${header.note ? `<div class="note">
    ${header.note}
  </div>` : ''}
</header>`
}

/**
 * Get the CSS styles for the paper header
 */
export function getHeaderStyles(): string {
  return `.paper-header {
  text-align: center;
  margin-bottom: 18px;
  font-family: "Times New Roman", serif;
}

.paper-header .line-1 {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
}

.paper-header .title {
  margin: 10px 0;
}

.paper-header .subject {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 4px;
}

.paper-header .code {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
}

.paper-header .meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-top: 6px;
  width: 100%;
  text-align: left;
}

.paper-header .meta-row span:first-child {
  text-align: left;
}

.paper-header .meta-row span:last-child {
  text-align: right;
}

.paper-header .note {
  text-align: left;
  margin-top: 8px;
  font-size: 13px;
}`
}

/**
 * Remove header content from the raw HTML after it's been extracted
 * This prevents duplicate content in the exported document
 */
export function removeHeaderFromHTML(htmlContent: string, header: ParsedHeader): string {
  if (!header) return htmlContent

  let cleaned = htmlContent

  // Remove each header component from the HTML
  if (header.semesterLine) {
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*<strong>\\s*${escapeRegExp(header.semesterLine)}\\s*</strong>\\s*</p>`, 'gi'), '')
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*${escapeRegExp(header.semesterLine)}\\s*</p>`, 'gi'), '')
  }

  if (header.subject) {
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*<strong>\\s*${escapeRegExp(header.subject)}\\s*</strong>\\s*</p>`, 'gi'), '')
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*${escapeRegExp(header.subject)}\\s*</p>`, 'gi'), '')
  }

  if (header.code) {
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*<strong>\\s*${escapeRegExp(header.code)}\\s*</strong>\\s*</p>`, 'gi'), '')
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*${escapeRegExp(header.code)}\\s*</p>`, 'gi'), '')
  }

  if (header.timeAllotted && header.fullMarks) {
    const timeMarksText = `Time Allotted : ${header.timeAllotted}.*?Full Marks : ${header.fullMarks}`
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*${timeMarksText}\\s*</p>`, 'gi'), '')
  }

  if (header.note) {
    cleaned = cleaned.replace(new RegExp(`<p[^>]*>\\s*${escapeRegExp(header.note)}\\s*</p>`, 'gi'), '')
  }

  // Clean up excessive whitespace and empty paragraphs
  cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '')
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')

  return cleaned
}

/**
 * Helper function to escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
