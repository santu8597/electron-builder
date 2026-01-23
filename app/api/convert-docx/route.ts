import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('Attempting document conversion for:', file.name)

    // Try to convert with pandoc first (will fail if pandoc not installed)
    try {
      const htmlContent = await convertWithPandoc(file)
      console.log('Document converted successfully with pandoc')
      return NextResponse.json({ html: htmlContent, method: 'pandoc' })
    } catch (pandocError) {
      console.log('Pandoc conversion failed:', (pandocError as Error).message)
      
      // Fallback to mammoth
      try {
        const htmlContent = await convertWithMammoth(file)
        console.log('Document converted successfully with mammoth fallback')
        return NextResponse.json({ html: htmlContent, method: 'mammoth' })
      } catch (mammothError) {
        console.error('Mammoth conversion also failed:', mammothError)
        throw new Error(`Both pandoc and mammoth conversion failed. Pandoc: ${(pandocError as Error).message}, Mammoth: ${(mammothError as Error).message}`)
      }
    }
  } catch (error) {
    console.error('Conversion error:', error)
    return NextResponse.json(
      { error: 'Failed to convert document', details: (error as Error).message },
      { status: 500 }
    )
  }
}

/**
 * Convert DOCX using Pandoc with enhanced options for math, tables, and images
 */
async function convertWithPandoc(file: File): Promise<string> {
  // Create temporary directory with safe path handling
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-convert-'))
  const inputPath = path.join(tempDir, 'input.docx')
  const outputPath = path.join(tempDir, 'output.html')
  const mediaDir = path.join(tempDir, 'media')

  try {
    // Create media directory
    fs.mkdirSync(mediaDir, { recursive: true })

    // Write file to temporary location
    const buffer = await file.arrayBuffer()
    fs.writeFileSync(inputPath, Buffer.from(buffer))
    
    // Verify file was written
    if (!fs.existsSync(inputPath)) {
      throw new Error('Failed to write input file to temporary directory')
    }

    // Try to find pandoc executable
    let pandocExecutable = 'pandoc'
    
    // Check common Windows installation paths
    const possiblePaths = [
      process.env.USERNAME ? `C:\\Users\\${process.env.USERNAME}\\scoop\\apps\\pandoc\\current\\pandoc.exe` : null,
      'C:\\Program Files\\Pandoc\\pandoc.exe',
      'C:\\Program Files (x86)\\Pandoc\\pandoc.exe'
    ].filter(Boolean) as string[]
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        pandocExecutable = p
        break
      }
    }
    
    // Build pandoc command with comprehensive options
    const pandocArgs = [
      '--from=docx',
      '--to=html',
      '--wrap=none',
      '--mathjax',
      `--extract-media=${mediaDir}`,
      '--standalone',
      '--preserve-tabs',
      '--section-divs',
      '--html-q-tags',
      '-o',
      outputPath,
      inputPath
    ]

    const pandocCommand = `"${pandocExecutable}" ${pandocArgs.map(arg => {
      // Only quote arguments with spaces or special characters
      if (arg.includes(' ') && !arg.startsWith('--')) {
        return `"${arg}"`
      }
      return arg
    }).join(' ')}`
    
    console.log('Running pandoc command:', pandocCommand)

    // Execute pandoc
    await execAsync(pandocCommand, { 
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true
    })

    // Check if output file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Pandoc did not generate output file')
    }

    // Read the HTML output
    const htmlContent = fs.readFileSync(outputPath, 'utf-8')
    
    // Process images to base64 if they exist
    const processedHtml = await processImagesInHtml(htmlContent, mediaDir)

    return processedHtml
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup temp directory:', cleanupError)
    }
  }
}

/**
 * Process images in HTML and convert to base64
 */
async function processImagesInHtml(html: string, mediaDir: string): Promise<string> {
  if (!fs.existsSync(mediaDir)) {
    return html
  }

  let processedHtml = html

  // Find all image references
  const imgRegex = /<img[^>]+src="([^"]*)"[^>]*>/g
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    const imgSrc = match[1]
    const fullImagePath = path.resolve(mediaDir, imgSrc)

    if (fs.existsSync(fullImagePath)) {
      try {
        const imageBuffer = fs.readFileSync(fullImagePath)
        const ext = path.extname(fullImagePath).toLowerCase()
        const mimeType = getMimeType(ext)
        const base64 = imageBuffer.toString('base64')
        const dataUrl = `data:${mimeType};base64,${base64}`

        processedHtml = processedHtml.replace(imgSrc, dataUrl)
      } catch (error) {
        console.warn(`Failed to process image ${imgSrc}:`, error)
      }
    }
  }

  return processedHtml
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: { [key: string]: string } = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  }
  return mimeTypes[ext] || 'image/png'
}

/**
 * Fallback conversion using Mammoth
 */
async function convertWithMammoth(file: File): Promise<string> {
  try {
    const mammoth = (await import("mammoth")).default
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const result = await mammoth.convertToHtml({ 
      buffer
    }, {
      convertImage: mammoth.images.imgElement(function(image: any) {
        return image.read("base64").then(function(imageBuffer: string) {
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          }
        }).catch(() => {
          return { src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" }
        })
      }),
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "b => strong",
        "i => em"
      ]
    })
    
    return result.value
  } catch (error) {
    console.error('Mammoth conversion error:', error)
    // Final fallback to raw text
    const mammoth = (await import("mammoth")).default
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const textResult = await mammoth.extractRawText({ buffer })
    return `<div>${textResult.value.replace(/\n/g, '<br>')}</div>`
  }
}