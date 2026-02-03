import type { Section } from "@/app/page"
import { exportDocument } from "./electron-api"

/**
 * Convert blob URLs back to data URLs for export
 * Blob URLs don't work outside the browser context, so we need to convert them back
 */
async function convertBlobUrlsToDataUrls(html: string): Promise<string> {
  if (!html || !html.includes('blob:')) return html;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img[src^="blob:"]');
  
  console.log(`Found ${images.length} images with blob URLs to convert`);
  
  // Convert all blob URLs to data URLs and scale down
  const conversions = Array.from(images).map(async (img) => {
    const blobUrl = img.getAttribute('src');
    if (!blobUrl) return null;
    
    try {
      // Fetch the blob data
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      // Convert blob to data URL and get image dimensions
      return new Promise<{ img: Element; dataUrl: string; naturalWidth: number; naturalHeight: number }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            // Create temporary image to get natural dimensions
            const tempImg = new Image();
            tempImg.onload = () => {
              resolve({ 
                img, 
                dataUrl: reader.result as string,
                naturalWidth: tempImg.naturalWidth,
                naturalHeight: tempImg.naturalHeight
              });
            };
            tempImg.onerror = () => reject(new Error('Failed to load image'));
            tempImg.src = reader.result as string;
          } else {
            reject(new Error('Failed to convert blob to data URL'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Failed to convert blob URL to data URL:', error);
      return null;
    }
  });
  
  const results = await Promise.all(conversions);
  
  // Apply the conversions and reduce all dimensions to 60%
  results.forEach(result => {
    if (result) {
      const width = Math.round(result.naturalWidth * 0.7);
      const height = Math.round(result.naturalHeight * 0.7);
      
      console.log(`Setting image dimensions: ${result.naturalWidth}x${result.naturalHeight} → ${width}x${height}`);
      
      result.img.setAttribute('src', result.dataUrl);
      result.img.setAttribute('width', width.toString());
      result.img.setAttribute('height', height.toString());
      result.img.removeAttribute('style');
      result.img.removeAttribute('data-blob-url');
    }
  });
  
  return doc.body.innerHTML;
}

/**
 * EXPORT STRATEGY (Updated Jan 2026):
 * 
 * The new clean export approach provides:
 * 1. Selection Filtering - Only exports questions with IDs in selectedQuestionIds array
 * 2. Raw LaTeX Preservation - Strips HTML/KaTeX artifacts, preserves original LaTeX
 * 3. Matrix Display Conversion - Converts inline matrix equations to display mode ($$...$$)
 * 4. Clean Pandoc Input - Generates pure HTML + LaTeX for optimal Word conversion
 * 
 * Functions:
 * - extractRawLatex() - Removes KaTeX HTML, decodes entities, keeps raw LaTeX
 * - convertInlineMatricesToDisplay() - Detects inline matrices, converts to display mode
 * - generateCleanHTMLForExport() - Main clean HTML generator with filtering
 * - exportToWordWithPandoc() - Word export with clean LaTeX (recommended)
 * - exportToPDFWithPandoc() - PDF export with clean LaTeX
 * 
 * Legacy functions (kept for backward compatibility):
 * - generateHTMLForPandoc() - Old HTML generator without filtering
 * - exportToPDF() - Direct PDF export using jsPDF
 * - exportToWord() - Direct Word export using docx library
 */

/**
 * Export question paper to PDF format
 */
export async function exportToPDF(title: string, sections: Section[]): Promise<void> {
  try {
    // Dynamically import jsPDF to reduce bundle size
    const { jsPDF } = await import("jspdf")

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - 2 * margin

    let yPosition = margin

    // Helper function to add text with word wrapping
    const addWrappedText = (
      text: string,
      fontSize: number,
      fontStyle: "normal" | "bold" = "normal",
      maxWidth = contentWidth,
    ) => {
      doc.setFontSize(fontSize)
      if (fontStyle === "bold") {
        doc.setFont(undefined, "bold")
      } else {
        doc.setFont(undefined, "normal")
      }

      const lines = doc.splitTextToSize(text, maxWidth)
      const lineHeight = fontSize * 0.35

      lines.forEach((line: string) => {
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }
        doc.text(line, margin, yPosition)
        yPosition += lineHeight
      })

      doc.setFont(undefined, "normal")
    }

    // Title and metadata
    addWrappedText(title, 18, "bold")
    yPosition += 3

    const totalMarks = sections.reduce((sum, section) => {
      return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
    }, 0)
    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0)

    addWrappedText(`Total Marks: ${totalMarks} | Questions: ${totalQuestions}`, 10)
    yPosition += 8

    // Draw horizontal line
    doc.setDrawColor(55, 85, 150) // Navy blue
    doc.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 5

    // Sections
    sections.forEach((section, sectionIndex) => {
      // Section title
      addWrappedText(section.title.toUpperCase(), 13, "bold")
      yPosition += 3

      // Section instructions
      if (section.instructions) {
        addWrappedText(section.instructions, 9)
        yPosition += 2
      }

      // Questions
      section.questions.forEach((question, qIndex) => {
        const questionNumber = `Q${sectionIndex + 1}.${qIndex + 1}`
        const questionText = `${questionNumber} ${question.text} [${question.marks} marks]`

        addWrappedText(questionText, 10)
        yPosition += 3
      })

      yPosition += 4
    })

    // Add footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`Generated by Question Paper Setter`, margin, pageHeight - 5)

    // Download
    doc.save(`${title.replace(/\s+/g, "_")}.pdf`)
  } catch (error) {
    throw new Error("Failed to export PDF. Please ensure jsPDF is installed.")
  }
}

/**
 * Export question paper to Word format
 */
export async function exportToWord(title: string, sections: Section[]): Promise<void> {
  try {
    // Dynamically import docx to reduce bundle size
    const {
      Document,
      Packer,
      Paragraph,
      HeadingLevel,
      TextRun,
      Table,
      TableCell,
      TableRow,
      BorderStyle,
      AlignmentType,
      convertInchesToTwip,
    } = await import("docx")

    const totalMarks = sections.reduce((sum, section) => {
      return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
    }, 0)
    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0)

    const sections_content = [
      // Title
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }),

      // Metadata
      new Paragraph({
        text: `Total Marks: ${totalMarks} | Questions: ${totalQuestions}`,
        spacing: { after: 400 },
      }),
    ]

    // Add sections and questions
    sections.forEach((section, sectionIndex) => {
      sections_content.push(
        new Paragraph({
          text: section.title,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
      )

      if (section.instructions) {
        sections_content.push(
          new Paragraph({
            text: `Instructions: ${section.instructions}`,
            spacing: { after: 200 },
            italics: true,
          }),
        )
      }

      section.questions.forEach((question, qIndex) => {
        const questionNumber = `${sectionIndex + 1}.${qIndex + 1}`
        sections_content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Q${questionNumber} `,
                bold: true,
              }),
              new TextRun({
                text: `${question.text} `,
              }),
              new TextRun({
                text: `[${question.marks} marks]`,
                italics: true,
              }),
            ],
            spacing: { after: 100 },
          }),
        )
      })
    })

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: sections_content,
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${title.replace(/\s+/g, "_")}.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    throw new Error("Failed to export Word document. Please ensure docx library is installed.")
  }
}

/**
 * Export as plain text for backup
 */
export function exportAsText(title: string, sections: Section[]): void {
  let content = `${title}\n`
  content += `${"=".repeat(title.length)}\n\n`

  const totalMarks = sections.reduce((sum, section) => {
    return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
  }, 0)

  content += `Total Marks: ${totalMarks}\n`
  content += `Total Questions: ${sections.reduce((sum, s) => sum + s.questions.length, 0)}\n\n`

  sections.forEach((section, sectionIndex) => {
    content += `\n${section.title.toUpperCase()}\n`
    content += `${"-".repeat(section.title.length)}\n`

    if (section.instructions) {
      content += `\nInstructions: ${section.instructions}\n`
    }

    section.questions.forEach((question, qIndex) => {
      content += `\nQ${sectionIndex + 1}.${qIndex + 1} ${question.text}\n`
      content += `[${question.marks} marks] [${question.type}]\n`
    })
  })

  const blob = new Blob([content], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${title.replace(/\s+/g, "_")}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Extract raw LaTeX from question text, removing HTML and KaTeX artifacts
 */
function extractRawLatex(text: string): string {
  if (!text) return ''
  
  let cleaned = text
  
  // Handle [MATH]...[/MATH] tags from parser - extract the content inside
  cleaned = cleaned.replace(/\[MATH\]([\s\S]*?)\[\/MATH\]/g, (match, mathContent) => {
    // If it's MathML, try to preserve it or extract LaTeX if available
    if (mathContent.includes('<math')) {
      // For now, preserve MathML as-is for Pandoc to handle
      return mathContent
    }
    return mathContent
  })
  
  // Handle [TABLE]...[/TABLE] tags - preserve table HTML
  cleaned = cleaned.replace(/\[TABLE\]([\s\S]*?)\[\/TABLE\]/g, (match, tableContent) => {
    return tableContent
  })
  
  // Handle [IMAGE]...[/IMAGE] tags - preserve image HTML with dimensions locked
  cleaned = cleaned.replace(/\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/g, (match, imageContent) => {
    return imageContent.replace(/<img([^>]*?)>/gi, (imgTag, attrs) => {
      const widthMatch = attrs.match(/width=["']?(\d+)["']?/i)
      const heightMatch = attrs.match(/height=["']?(\d+)["']?/i)
      
      if (widthMatch && heightMatch) {
        const width = widthMatch[1]
        const height = heightMatch[1]
        let newAttrs = attrs.replace(/style=["'][^"']*["']/gi, '').trim()
        newAttrs += ` style="width:${width}px !important;height:${height}px !important;max-width:${width}px;max-height:${height}px;"`
        return `<img${newAttrs}>`
      }
      return imgTag
    })
  })
  
  // Remove KaTeX-generated HTML (spans with katex classes)
  // Use global flag with dotAll behavior via [\s\S] instead of 's' flag for compatibility
  cleaned = cleaned.replace(/<span class="katex[^"]*"[^>]*>[\s\S]*?<\/span>/g, (match) => {
    // Try to extract the original LaTeX from the katex HTML
    const latexMatch = match.match(/data-latex="([^"]*)"/)
    return latexMatch ? latexMatch[1] : match
  })
  
  // DON'T remove all HTML tags - we need to preserve MathML and tables
  // Only remove specific UI-related tags
  cleaned = cleaned.replace(/<(button|span class="marks"|div class="question-number")[^>]*>[\s\S]*?<\/\1>/g, '')
  
  // Decode HTML entities
  cleaned = cleaned
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  
  return cleaned.trim()
}

/**
 * Convert inline matrix equations to display mode
 */
function convertInlineMatricesToDisplay(text: string): string {
  // Pattern to match inline math with matrix environments
  const inlineMatrixPattern = /\$\s*(\\begin\{(?:bmatrix|pmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array)\}[\s\S]*?\\end\{(?:bmatrix|pmatrix|vmatrix|Bmatrix|Vmatrix|matrix|array)\})\s*\$/g
  
  // Convert inline matrices to display mode
  return text.replace(inlineMatrixPattern, (match, matrixContent) => {
    return `$$${matrixContent}$$`
  })
}

/**
 * Generate clean export-ready HTML with only selected questions and raw LaTeX
 */
async function generateCleanHTMLForExport(title: string, sections: Section[], selectedQuestionIds?: string[]): Promise<string> {
  const totalMarks = sections.reduce((sum, section) => {
    return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
  }, 0)

  // Helper function to clean and prepare math for Pandoc
  const prepareMathForPandoc = (text: string): string => {
    if (!text) return ''
    
    let cleaned = text
    
    // Handle $$$ placeholders FIRST (e.g., $$$1$$$, $$$2$$$) - these are equation/matrix placeholders
    // Convert them to display math blocks for Pandoc
    cleaned = cleaned.replace(/\$\$\$([^$]+)\$\$\$/g, (match, content) => {
      // Keep the content visible in display math mode
      return `<p class="math-display">$$${content.trim()}$$</p>`
    })
    
    // Extract LaTeX from Pandoc's HTML math spans - but keep the structure
    // Handle display math: <span class="math display">\[...\]</span> -> keep as display block
    cleaned = cleaned.replace(/<span class="math display">\\\[([\s\S]*?)\\\]<\/span>/g, (match, latex) => {
      return `<p class="math-display">$$${latex}$$</p>`
    })
    
    // Handle inline math: <span class="math inline">\(...\)</span> -> convert to $...$
    cleaned = cleaned.replace(/<span class="math inline">\\\(([\s\S]*?)\\\)<\/span>/g, (match, latex) => {
      return `$${latex}$`
    })
    
    // Unwrap [MATH] tags but preserve the MathML/LaTeX content inside
    cleaned = cleaned.replace(/\[MATH\]([\s\S]*?)\[\/MATH\]/g, (match, mathContent) => {
      return mathContent // Preserve MathML or LaTeX as-is
    })
    
    // Unwrap [TABLE] tags but preserve table HTML
    cleaned = cleaned.replace(/\[TABLE\]([\s\S]*?)\[\/TABLE\]/g, (match, tableContent) => {
      return tableContent
    })
    
    // Unwrap [IMAGE] tags and ensure dimensions are preserved for Pandoc
    cleaned = cleaned.replace(/\[IMAGE\]([\s\S]*?)\[\/IMAGE\]/g, (match, imageContent) => {
      // Keep width/height attributes and ensure they're not overridden by CSS
      return imageContent.replace(/<img([^>]*?)>/gi, (imgTag, attrs) => {
        const widthMatch = attrs.match(/width=["']?(\d+)["']?/i)
        const heightMatch = attrs.match(/height=["']?(\d+)["']?/i)
        
        if (widthMatch && heightMatch) {
          const width = widthMatch[1]
          const height = heightMatch[1]
          
          // Remove any existing style attribute
          let newAttrs = attrs.replace(/style=["'][^"']*["']/gi, '').trim()
          
          // Keep the width and height attributes for Pandoc, and add explicit style
          // Use both px for browsers and explicit dimensions for Pandoc
          newAttrs += ` style="width:${width}px !important;height:${height}px !important;max-width:${width}px;max-height:${height}px;"`
          
          return `<img${newAttrs}>`
        }
        return imgTag
      })
    })
    
    // Clean up excessive whitespace (but preserve single line breaks)
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    return cleaned
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Cambria', serif; margin: 40px; line-height: 1.6; font-size: 14pt; }
    h1 { font-family: 'Cambria', serif; text-align: center; font-size: 24pt; margin-bottom: 10px; }
    .metadata { text-align: center; font-size: 12pt; margin-bottom: 20px; }
    .section-title { font-family: 'Cambria', serif; font-size: 16pt; font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; }
    .subsection-title { font-family: 'Cambria', serif; font-size: 14pt; font-weight: bold; margin-top: 15px; margin-bottom: 10px; background-color: #f0f0f0; padding: 5px; }
    .instructions { font-style: italic; font-size: 12pt; margin-bottom: 10px; }
    .question { margin-bottom: 15px; line-height: 1.8; }
    .question-number { font-weight: bold; margin-right: 8px; }
    .marks { font-weight: bold; margin-left: 8px; }
    p { margin: 8px 0; line-height: 1.6; }
    table { border-collapse: collapse; margin: 10px 0; width: 100%; }
    table, th, td { border: 1px solid #333; padding: 8px; }
    img { display: block; margin: 10px auto; }
    .math-display { text-align: center; margin: 15px 0; font-size: 14pt; }
    math { display: inline-block; margin: 5px; }
    sup, sub { font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="metadata">
    <p><strong>Total Marks:</strong> ${totalMarks}</p>
  </div>
  <hr>
`

  for (const section of sections) {
    // Filter questions if selectedQuestionIds is provided
    let questionsToExport = section.questions
    if (selectedQuestionIds && selectedQuestionIds.length > 0) {
      questionsToExport = section.questions.filter(q => selectedQuestionIds.includes(q.uniqueId || q.id))
    }
    
    // Skip section if no questions to export
    if (questionsToExport.length === 0) continue
    
    html += `  <div class="section">
    <h2 class="section-title">${section.title}</h2>
`
    
    if (section.instructions) {
      html += `    <p class="instructions">${section.instructions}</p>
`
    }

    // Check if this is Group A with subsections
    const isGroupA = section.title.match(/^Group\s+A/i)
    
    if (isGroupA && questionsToExport.length > 0) {
      const mcqQuestions = questionsToExport.filter(q => q.type === 'mcq')
      const fillInBlanksQuestions = questionsToExport.filter(q => 
        q.section?.includes('Fill in the Blanks') || q.section?.includes('FILL IN THE')
      )

      // MCQ Subsection
      if (mcqQuestions.length > 0) {
        html += `    <h3 class="subsection-title">Multiple Choice Questions</h3>
`
        for (const [index, question] of mcqQuestions.entries()) {
          const cleanText = prepareMathForPandoc(question.text)
          html += `    <div class="question">
      <span class="question-number">${toRomanNumeral(index + 1)}.</span><span>${cleanText}</span>
    </div>
`
        }
      }

      // Fill in the Blanks Subsection
      if (fillInBlanksQuestions.length > 0) {
        html += `    <h3 class="subsection-title">Fill in the Blanks</h3>
`
        for (const [index, question] of fillInBlanksQuestions.entries()) {
          const cleanText = prepareMathForPandoc(question.text)
          html += `    <div class="question">
      <span class="question-number">${index + 1}.</span><span>${cleanText}</span>
    </div>
`
        }
      }
    } else {
      // For other groups (B, C, D, E) or sections without subsections
      questionsToExport.forEach((question, index) => {
        const cleanText = prepareMathForPandoc(question.text)
        const marks = section.title.match(/^Group\s+[A]/i) ? '1 mark' : `${question.marks} marks`
        html += `    <div class="question">
      <span class="question-number">${index + 1}.</span><span>${cleanText}</span>
      <span class="marks">[${marks}]</span>
    </div>
`
      })
    }

    html += `  </div>
`
  }

  html += `</body>
</html>`

  return html
}

/**
 * Generate HTML content for pandoc export (Legacy - kept for backward compatibility)
 */
function generateHTMLForPandoc(title: string, sections: Section[]): string {
  const totalMarks = sections.reduce((sum, section) => {
    return sum + section.questions.reduce((sectionSum, q) => sectionSum + q.marks, 0)
  }, 0)

  // Helper function to ensure math is in the right format
  const convertMathForPandoc = (text: string): string => {
    // Convert \(...\) to $...$ for Pandoc
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$')
    // Convert \[...\] to $$...$$ 
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$$1$$$$$$')
    return text
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Cambria', serif; margin: 40px; line-height: 1.6; }
    h1 { font-family: 'Cambria', serif; text-align: center; font-size: 24pt; margin-bottom: 10px; }
    .metadata { text-align: center; font-size: 11pt; margin-bottom: 20px; }
    .section-title { font-family: 'Cambria', serif; font-size: 14pt; font-weight: bold; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; }
    .subsection-title { font-family: 'Cambria', serif; font-size: 12pt; font-weight: bold; margin-top: 15px; margin-bottom: 10px; background-color: #f0f0f0; padding: 5px; }
    .instructions { font-style: italic; font-size: 10pt; margin-bottom: 10px; }
    .question { margin-bottom: 15px; font-size: 11pt; line-height: 1.8; }
    .question-number { font-weight: bold; margin-right: 8px; }
    .marks { font-weight: bold; margin-left: 8px; }
    table { border-collapse: collapse; margin: 10px 0; }
    table, th, td { border: 1px solid #333; padding: 8px; }
    img { max-width: 100%; height: auto; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="metadata">
    <p><strong>Total Marks:</strong> ${totalMarks}</p>
  </div>
  <hr>
`

  sections.forEach((section) => {
    html += `  <div class="section">
    <h2 class="section-title">${section.title}</h2>
`
    
    if (section.instructions) {
      html += `    <p class="instructions">${section.instructions}</p>
`
    }

    // Check if this is Group A with subsections
    const isGroupA = section.title.match(/^Group\s+A/i)
    
    if (isGroupA && section.questions.length > 0) {
      const mcqQuestions = section.questions.filter(q => q.type === 'mcq')
      const fillInBlanksQuestions = section.questions.filter(q => 
        q.section?.includes('Fill in the Blanks') || q.section?.includes('FILL IN THE')
      )

      // MCQ Subsection
      if (mcqQuestions.length > 0) {
        html += `    <h3 class="subsection-title">Multiple Choice Questions</h3>
`
        mcqQuestions.forEach((question, index) => {
          const cleanText = convertMathForPandoc(question.text)
          html += `    <div class="question">
      <span class="question-number">${toRomanNumeral(index + 1)}.</span><span>${cleanText}</span>
    </div>
`
        })
      }

      // Fill in the Blanks Subsection
      if (fillInBlanksQuestions.length > 0) {
        html += `    <h3 class="subsection-title">Fill in the Blanks</h3>
`
        fillInBlanksQuestions.forEach((question, index) => {
          const cleanText = convertMathForPandoc(question.text)
          html += `    <div class="question">
      <span class="question-number">${index + 1}.</span><span>${cleanText}</span>
    </div>
`
        })
      }
    } else {
      // For other groups (B, C, D, E) or sections without subsections
      section.questions.forEach((question, index) => {
        const cleanText = convertMathForPandoc(question.text)
        const marks = section.title.match(/^Group\s+[A]/i) ? '1 mark' : '12 marks'
        html += `    <div class="question">
      <span class="question-number">${index + 1}.</span><span>${cleanText}</span>
      <span class="marks">[${marks}]</span>
    </div>
`
      })
    }

    html += `  </div>
`
  })

  html += `  <script>
    // Wait for MathJax to load and process the page
    if (window.MathJax) {
      MathJax.typesetPromise().catch((err) => console.log('MathJax typeset error:', err));
    }
  </script>
</body>
</html>`

  return html
}

/**
 * Convert number to roman numerals
 */
function toRomanNumeral(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  
  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result.toLowerCase();
}

/**
 * Export using pandoc (Word) with clean LaTeX and selected questions only
 */
export async function exportToWordWithPandoc(
  title: string, 
  sections: Section[], 
  selectedQuestionIds?: string[]
): Promise<void> {
  try {
    // Convert all blob URLs to data URLs in question text before generating HTML
    const sectionsWithDataUrls = await Promise.all(sections.map(async (section) => ({
      ...section,
      questions: await Promise.all(section.questions.map(async (q) => ({
        ...q,
        text: await convertBlobUrlsToDataUrls(q.text)
      })))
    })));
    
    const html = await generateCleanHTMLForExport(title, sectionsWithDataUrls, selectedQuestionIds)
    
    const filename = title.replace(/\s+/g, '_')

    const blob = await exportDocument(html, 'docx', filename)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error: any) {
    console.error('Export to Word error:', error)
    throw new Error(error.message || 'Failed to export to Word')
  }
}

/**
 * Export using pandoc (PDF) with clean LaTeX and selected questions only - Browser-based fallback
 */
export async function exportToPDFWithPandoc(
  title: string, 
  sections: Section[], 
  selectedQuestionIds?: string[]
): Promise<void> {
  try {
    // Try browser-based PDF generation first (no server dependencies needed)
    await exportToPDFBrowser(title, sections, selectedQuestionIds)
  } catch (error: any) {
    console.error('Browser PDF export failed, trying pandoc:', error)
    
    // Fallback to pandoc if browser method fails
    try {
      // Convert blob URLs to data URLs before generating HTML
      const sectionsWithDataUrls = await Promise.all(sections.map(async (section) => ({
        ...section,
        questions: await Promise.all(section.questions.map(async (q) => ({
          ...q,
          text: await convertBlobUrlsToDataUrls(q.text)
        })))
      })));
      
      const html = await generateCleanHTMLForExport(title, sectionsWithDataUrls, selectedQuestionIds)
      const filename = title.replace(/\s+/g, '_')

      const blob = await exportDocument(html, 'pdf', filename)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (pandocError: any) {
      // If all else fails, use browser method
      await exportToPDFBrowser(title, sections, selectedQuestionIds)
    }
  }
}

/**
 * Export to PDF using browser's print functionality with selected questions
 */
async function exportToPDFBrowser(
  title: string, 
  sections: Section[], 
  selectedQuestionIds?: string[]
): Promise<void> {
  // Create a new window with the content
  const printWindow = window.open('', '_blank')
  
  if (!printWindow) {
    throw new Error('Please allow popups to export PDF')
  }

  const html = generateCleanHTMLForExport(title, sections, selectedQuestionIds)
  
  // Enhanced CSS for better PDF output with math support
  const enhancedCSS = `
    <style>
      @page {
        size: A4;
        margin: 20mm;
      }
      body { 
        font-family: 'Cambria', serif; 
        font-size: 12pt;
        line-height: 1.8;
        color: #000;
      }
      h1 { 
        font-family: 'Cambria', serif;
        text-align: center; 
        font-size: 20pt; 
        margin-bottom: 10px;
        page-break-after: avoid;
      }
      .metadata { 
        text-align: center; 
        font-size: 11pt; 
        margin-bottom: 20px; 
      }
      .section-title { 
        font-family: 'Cambria', serif;
        font-size: 14pt; 
        font-weight: bold; 
        margin-top: 20px; 
        margin-bottom: 10px; 
        text-transform: uppercase;
        page-break-after: avoid;
      }
      .subsection-title { 
        font-family: 'Cambria', serif;
        font-size: 12pt; 
        font-weight: bold; 
        margin-top: 15px; 
        margin-bottom: 10px; 
        background-color: #f0f0f0; 
        padding: 8px;
        page-break-after: avoid;
      }
      .instructions { 
        font-style: italic; 
        font-size: 10pt; 
        margin-bottom: 10px; 
      }
      .question { 
        margin-bottom: 15px; 
        font-size: 11pt;
        line-height: 1.8;
        page-break-inside: avoid;
      }
      .question-number { 
        font-weight: bold;
        margin-right: 8px;
      }
      .marks { 
        font-weight: bold;
        margin-left: 8px;
      }
      hr {
        border: none;
        border-top: 2px solid #333;
        margin: 15px 0;
      }
      table {
        border-collapse: collapse;
        margin: 10px 0;
        page-break-inside: avoid;
      }
      table, th, td {
        border: 1px solid #333;
        padding: 8px;
      }
      img {
        max-width: 100%;
        height: auto;
        margin: 10px 0;
        page-break-inside: avoid;
      }
      mjx-container {
        margin: 5px 0;
      }
      @media print {
        body { margin: 0; }
        .no-print { display: none; }
      }
    </style>
  `
  
  const fullHTML = html.replace('</head>', `${enhancedCSS}</head>`)
  
  printWindow.document.write(fullHTML)
  printWindow.document.close()
  
  // Wait for MathJax to load and render, then print
  printWindow.onload = () => {
    // Check if MathJax is loaded
    const checkMathJax = () => {
      if (printWindow.MathJax && printWindow.MathJax.typesetPromise) {
        printWindow.MathJax.typesetPromise()
          .then(() => {
            // Wait a bit more for rendering to complete
            setTimeout(() => {
              printWindow.print()
              // Close the window after printing
              setTimeout(() => {
                printWindow.close()
              }, 100)
            }, 500)
          })
          .catch((err: any) => {
            console.error('MathJax error:', err)
            // Print anyway if MathJax fails
            setTimeout(() => {
              printWindow.print()
              setTimeout(() => {
                printWindow.close()
              }, 100)
            }, 250)
          })
      } else {
        // If MathJax not loaded yet, wait and try again
        setTimeout(checkMathJax, 100)
      }
    }
    
    // Start checking for MathJax after a brief delay
    setTimeout(checkMathJax, 500)
  }
}
