import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { html, format, filename } = await request.json()

    if (!html || !format) {
      return NextResponse.json(
        { error: 'HTML content and format are required' },
        { status: 400 }
      )
    }

    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-'))
    const inputFile = path.join(tempDir, 'input.html')
    const outputFile = path.join(tempDir, `output.${format}`)

    try {
      // Write HTML to temporary file
      await fs.writeFile(inputFile, html, 'utf-8')

      // For DOCX, we need to convert from HTML with proper math handling
      // Create a temporary markdown file for better math conversion
      const mdFile = path.join(tempDir, 'temp.md')

      // Run pandoc command
      if (format === 'pdf') {
        // Try different PDF engines in order of preference
        const pdfEngines = [
          'wkhtmltopdf',
          'weasyprint',
          'prince',
          'context',
          'pdfroff',
        ]
        
        let pdfCreated = false
        let lastError = null
        
        for (const engine of pdfEngines) {
          try {
            // Try to convert directly from HTML to PDF with the engine
            await execAsync(`pandoc "${inputFile}" -o "${outputFile}" --pdf-engine=${engine}`)
            pdfCreated = true
            break
          } catch (err: any) {
            lastError = err
            // If this engine failed, try the next one
            continue
          }
        }
        
        if (!pdfCreated) {
          // If all PDF engines failed, throw an error with instructions
          throw new Error(
            'No PDF engine found. Please install wkhtmltopdf: ' +
            'Download from https://wkhtmltopdf.org/downloads.html or use "Export as Word" instead.'
          )
        }
      } else if (format === 'docx') {
        // For DOCX: Use mathjax extension to read LaTeX from HTML, then convert to MathML
        await execAsync(`pandoc "${inputFile}" -f html+tex_math_dollars -t docx -o "${outputFile}" --mathml`)
      } else {
        return NextResponse.json(
          { error: 'Unsupported format. Use "pdf" or "docx"' },
          { status: 400 }
        )
      }

      // Read the output file
      const fileBuffer = await fs.readFile(outputFile)

      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true })

      // Return the file
      const contentType = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename || 'question-paper'}.${format}"`,
        },
      })
    } catch (error) {
      // Clean up on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      throw error
    }
  } catch (error: any) {
    console.error('Export error:', error)
    
    // Check if pandoc is not installed
    if (error.message?.includes('pandoc')) {
      return NextResponse.json(
        { 
          error: 'Pandoc is not installed. Please install pandoc to use this feature.',
          details: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to export document', details: error.message },
      { status: 500 }
    )
  }
}
