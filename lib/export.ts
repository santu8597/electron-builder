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
 * - generateCleanHTMLForExport() - Main clean HTML generator with filtering
 * - exportToWordWithPandoc() - Word export with clean LaTeX (recommended)
 * 
 * Legacy functions (kept for backward compatibility):
 * - exportToWord() - Direct Word export using docx library
 */

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
    
    // Preserve line breaks by keeping <p> tags and <br> tags
    // Don't strip <p> tags - they're essential for maintaining paragraph structure
    
    // Clean up excessive whitespace (but preserve single line breaks)
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    return cleaned
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Minimal styling - let template.docx control fonts and sizes */
    table { border-collapse: collapse; margin: 10px 0; width: 100%; }
    table, th, td { border: 1px solid #333; padding: 8px; }
    .math-display { text-align: center; margin: 15px 0; }
    .header-table { border: 1px solid black !important; }
    .header-table td { 
      border: 1px solid black !important; 
      border-top: 1px solid black !important;
      border-bottom: 1px solid black !important;
      border-left: 1px solid black !important;
      border-right: 1px solid black !important;
    }
  </style>
</head>
<body>
  <table class="header-table" border="1" style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; margin-bottom: 20px; border: 1px solid black;">
    <tr>
      <td style="border: 1px solid black; padding: 10px; width: 25%;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center; width: 50%;">
        <strong style="font-size: 14px;">B.TECH/CSE/6TH SEM/CSEN 3233/2024</strong>
      </td>
      <td style="border: 1px solid black; padding: 10px; width: 25%;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid black; padding: 10px;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center;">
        <strong style="font-size: 20px;">MACHINE LEARNING</strong><br>
        <strong style="font-size: 16px;">(CSEN 3233)</strong>
      </td>
      <td style="border: 1px solid black; padding: 10px;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid black; padding: 10px; text-align: left;"><strong>Time Allotted : 2½ hrs</strong></td>
      <td style="border: 1px solid black; padding: 10px;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: right;"><strong>Full Marks : 60</strong></td>
    </tr>
  </table>

  <table class="header-table" border="1" style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; margin-bottom: 20px; border: 1px solid black;">
    <tr>
      <td style="border: 1px solid black; padding: 10px; width: 25%;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center; width: 50%;"><strong><em>Figures out of the right margin indicate full marks.</em></strong></td>
      <td style="border: 1px solid black; padding: 10px; width: 25%;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid black; padding: 10px;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center;"><strong><em>Candidates are required to answer Group A and any 4 (four) from Group B to E, taking one from each group.</em></strong></td>
      <td style="border: 1px solid black; padding: 10px;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid black; padding: 10px;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center;"><strong><em>Candidates are required to give answer in their own words as far as practicable.</em></strong></td>
      <td style="border: 1px solid black; padding: 10px;"></td>
    </tr>
  </table>

  <table class="header-table" border="1" style="width: 100%; border-collapse: collapse; font-family: 'Times New Roman', Times, serif; margin-bottom: 20px; border: 1px solid black;">
    <tr>
      <td style="border: 1px solid black; padding: 10px; width: 25%;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center; width: 50%;"><strong>GROUP-A</strong></td>
      <td style="border: 1px solid black; padding: 10px; width: 25%;"></td>
    </tr>
    <tr>
      <td style="border: 1px solid black; padding: 10px; text-align: left; width: 25%;">1. Answer any twelve</td>
      <td style="border: 1px solid black; padding: 10px; width: 50%;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: right; width: 25%;"><strong>1 x 12</strong></td>
    </tr>
   

    <tr>
      <td style="border: 1px solid black; padding: 10px;"></td>
      <td style="border: 1px solid black; padding: 10px; text-align: center;"><em>Choose the correct alternative for the following</em></td>
      <td style="border: 1px solid black; padding: 10px;"></td>
    </tr>
  </table>

 
`

  for (const section of sections) {
    // Filter questions if selectedQuestionIds is provided
    let questionsToExport = section.questions
    if (selectedQuestionIds && selectedQuestionIds.length > 0) {
      questionsToExport = section.questions.filter(q => selectedQuestionIds.includes(q.uniqueId || q.id))
    }
    
    // Skip section if no questions to export
    if (questionsToExport.length === 0) continue
    
    // Check if this is Group A with subsections
    const isGroupA = section.title.match(/^Group\s+A/i)
    
    if (isGroupA && questionsToExport.length > 0) {
      const mcqQuestions = questionsToExport.filter(q => q.type === 'mcq')
      const fillInBlanksQuestions = questionsToExport.filter(q => 
        q.section?.includes('Fill in the Blanks') || q.section?.includes('FILL IN THE')
      )

      if (section.instructions) {
        html += `    <p><em>${section.instructions}</em></p>
`
      }

      // MCQ Subsection
      if (mcqQuestions.length > 0) {
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
      // For other groups (B, C, D, E) - show section title
      html += `  <h2>${section.title}</h2>
`
      
      if (section.instructions) {
        html += `    <p><em>${section.instructions}</em></p>
`
      }
      
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


