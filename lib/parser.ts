import type { Section, ParsedQuestion } from "@/app/page"
import { parseGroupA, parseMCQQuestions, parseFillInBlanksQuestions } from "./group-a-parser"
import { convertDocx } from "./electron-api"
import { parseQuestionPaperHeader, removeHeaderFromHTML, type ParsedHeader } from "./header-parser"

/**
 * Generate a unique ID for a question based on group, section, and number
 */
function generateUniqueQuestionId(group: string, sectionIndex: number, questionNumber: number): string {
  return `${group}-s${sectionIndex}-q${questionNumber}`
}

/**
 * Convert base64 data URLs to blob URLs to avoid browser limitations
 * This prevents ERR_INVALID_URL errors with large images
 */
function convertDataUrlsToBlobUrls(html: string): string {
  if (typeof window === 'undefined') return html;
  if (!html || !html.includes('data:image')) return html;
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = doc.querySelectorAll('img[src^="data:"]');
    
    let convertedCount = 0;
    images.forEach((img) => {
      const dataUrl = img.getAttribute('src');
      if (!dataUrl) return;
      
      // Convert all data URLs to blob URLs (not just large ones)
      // This ensures consistency and avoids any URL length issues
      try {
        // Extract base64 data and content type
        const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) return;
        
        const contentType = matches[1];
        const base64Data = matches[2];
        
        // Convert base64 to blob
        const byteCharacters = atob(base64Data);
        const byteArrays = [];
        
        for (let i = 0; i < byteCharacters.length; i += 512) {
          const slice = byteCharacters.slice(i, i + 512);
          const byteNumbers = new Array(slice.length);
          for (let j = 0; j < slice.length; j++) {
            byteNumbers[j] = slice.charCodeAt(j);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        
        const blob = new Blob(byteArrays, { type: contentType });
        const blobUrl = URL.createObjectURL(blob);
        
        img.setAttribute('src', blobUrl);
        img.setAttribute('data-original-size', base64Data.length.toString());
        img.setAttribute('data-blob-url', 'true');
        convertedCount++;
      } catch (error) {
        console.warn('Failed to convert image data URL to blob:', error);
      }
    });
    
    if (convertedCount > 0) {
      console.log(`Converted ${convertedCount} image(s) from data URLs to blob URLs`);
    }
    
    return doc.body.innerHTML;
  } catch (error) {
    console.error('Error in convertDataUrlsToBlobUrls:', error);
    return html;
  }
}

/**
 * Convert DOCX to HTML using browser-compatible methods
 */
async function convertDocxToHtml(file: File): Promise<string> {
  // Try using Electron API or server-side conversion first (supports pandoc)
  try {
    const result = await convertDocx(file);
    console.log('Converting image data URLs to blob URLs (server result)...');
    return convertDataUrlsToBlobUrls(result.html);
  } catch (error) {
    console.warn('Server/Electron conversion failed, using client-side fallback:', error);
  }

  // Fallback to client-side mammoth conversion
  try {
    const mammoth = (await import("mammoth")).default
    const arrayBuffer = await file.arrayBuffer()
    
    // Convert to HTML instead of plain text to preserve formatting
    const result = await mammoth.convertToHtml({ 
      arrayBuffer
    }, {
      convertImage: mammoth.images.imgElement(function(image: any) {
        return image.read("base64").then(function(imageBuffer: string) {
          return {
            src: "data:" + image.contentType + ";base64," + imageBuffer
          }
        }).catch(() => {
          // If image conversion fails, return a placeholder
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
    
    // Convert all data URLs to blob URLs immediately after conversion
    console.log('Converting image data URLs to blob URLs...');
    const convertedHtml = convertDataUrlsToBlobUrls(result.value);
    return convertedHtml
  } catch (error) {
    console.error('Client-side mammoth conversion failed:', error)
    
    // Final fallback to plain text extraction
    try {
      const mammoth = (await import("mammoth")).default
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return `<div>${result.value.replace(/\n/g, '<br>')}</div>`
    } catch (textError) {
      console.error('All conversion methods failed:', textError)
      throw new Error('Unable to process the document. Please ensure it is a valid Word document.')
    }
  }
}

/**
 * Parse HTML content using browser DOMParser and extract questions organized by groups and modules
 */
function parseHtmlContent(html: string): Section[] {
  // Parse all groups using the general parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // Parse the document structure (groups and modules)
  const groupData = parseGroupStructure(doc)
  
  // Convert to Section format with parsed questions
  const sections: Section[] = []
  
  for (const group of groupData) {
    if (group.modules) {
      // Group has modules
      for (const module of group.modules) {
        // Determine parser based on group and module type
        let questions: ParsedQuestion[] = []
        let instructions = ''
        
        // Check if it's Group A
        const isGroupA = group.group.match(/GROUP\s*[–-]?\s*A/i)
        
        if (isGroupA) {
          // Group A uses MCQ or Fill in the Blanks format with roman numerals
          // Use the dedicated Group A parser functions
          if (module.title.includes('Fill in the Blanks') || module.title.includes('FILL IN THE')) {
            questions = addGroupToQuestions(parseFillInBlanksQuestions(module.content, sections.length), group.group)
            instructions = 'Fill in the blanks with appropriate answers'
          } else {
            // MCQ format with roman numerals
            questions = addGroupToQuestions(parseMCQQuestions(module.content, sections.length), group.group)
            instructions = 'Multiple Choice Questions - Choose the correct alternative'
          }
        } else {
          // Other groups use regular format
          questions = addGroupToQuestions(parseRegularQuestions(module.content, sections.length), group.group)
        }
        
        const section: Section = {
          id: `section-${sections.length}`,
          title: `${group.group} - ${module.title}`,
          questions,
          ...(instructions && { instructions })
        }
        sections.push(section)
      }
    } else if (group.content) {
      // Group has direct content (no modules)
      const section: Section = {
        id: `section-${sections.length}`,
        title: group.group,
        questions: addGroupToQuestions(parseRegularQuestions(group.content, sections.length), group.group)
      }
      
      sections.push(section)
    }
  }
  
  return sections
}

/**
 * Extract group letter from group title (e.g., "GROUP A" -> "A")
 */
function extractGroupLetter(groupTitle: string): string {
  const match = groupTitle.match(/GROUP\s*[–-]?\s*([A-E])/i)
  return match ? match[1].toUpperCase() : ''
}

/**
 * Add group property to all questions based on group title
 * Also ensures uniqueId is properly formatted with group letter
 */
function addGroupToQuestions(questions: ParsedQuestion[], groupTitle: string): ParsedQuestion[] {
  const groupLetter = extractGroupLetter(groupTitle)
  return questions.map((q, index) => {
    // Update uniqueId to include the actual group letter if not already set properly
    const uniqueId = q.uniqueId || `${groupLetter}-s0-q${index + 1}`
    return {
      ...q,
      group: groupLetter,
      uniqueId: uniqueId.startsWith(groupLetter) ? uniqueId : `${groupLetter}-${uniqueId}`
    }
  })
}

/**
 * Parse document structure into groups and modules
 * Based on regex.js parseExamPaper function
 */
interface GroupData {
  group: string
  modules?: ModuleData[]
  content?: string[]
}

interface ModuleData {
  title: string
  content: string[]
}

function parseGroupStructure(doc: Document): GroupData[] {
  const result: GroupData[] = []
  let currentGroup: GroupData | null = null
  let currentModule: ModuleData | null = null
  
  const children = Array.from(doc.body.children)
  console.log(`\n=== Parsing Group Structure ===`)
  console.log(`Total elements: ${children.length}`)
  
  for (const element of children) {
    if (element.tagName === 'P') {
      const strongTag = element.querySelector('strong')
      
      if (strongTag) {
        const text = strongTag.textContent?.trim() || ''
        
        // Check for GROUP heading (handles all formats: GROUP – A, GROUP B, GROUP-C, etc.)
        if (text.match(/^GROUP\s*[–-]?\s*[A-E]/i) || text.startsWith('GROUP')) {
          if (currentGroup) {
            result.push(currentGroup)
          }
          
          currentGroup = {
            group: text
          }
          currentModule = null
          continue
        }
        
        // Check for MODULE heading
        if (text.startsWith('Module')) {
          if (currentGroup) {
            if (!currentGroup.modules) {
              currentGroup.modules = []
            }
            currentModule = {
              title: text,
              content: []
            }
            currentGroup.modules.push(currentModule)
          }
          continue
        }
        
        // Check for FILL IN THE GAPS heading
        if (text === 'FILL IN THE GAPS' || text.includes('FILL IN THE')) {
          if (currentGroup) {
            if (!currentGroup.modules) {
              currentGroup.modules = []
            }
            currentModule = {
              title: 'Fill in the Blanks',
              content: []
            }
            currentGroup.modules.push(currentModule)
          }
          continue
        }
      }
    }
    
    // Add content to current module or group
    if (currentModule) {
      currentModule.content.push(element.outerHTML)
    } else if (currentGroup) {
      if (!currentGroup.content) {
        currentGroup.content = []
      }
      currentGroup.content.push(element.outerHTML)
    }
  }
  
  // Push the last group
  if (currentGroup) {
    result.push(currentGroup)
  }
  
  return result
}

/**
 * Parse MCQs from HTML content using DOM traversal
 * Based on regex.js parseMCQs function
 * Preserves images, tables, and HTML formatting
 */
function parseMCQsFromDOM(contentHtmlArray: string[], sectionIndex: number): ParsedQuestion[] {
  const contentHtml = contentHtmlArray.join('\n')
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(contentHtml, 'text/html')
  
  const mcqs: ParsedQuestion[] = []
  
  // Get all elements - recursively extract from wrappers
  let allElements = Array.from(doc.body.children)
  
  // If wrapped in a single container (blockquote, div, etc), extract children
  while (allElements.length === 1 && ['BLOCKQUOTE', 'DIV', 'SECTION'].includes(allElements[0].tagName)) {
    if (allElements[0].children.length > 0) {
      allElements = Array.from(allElements[0].children)
    } else {
      break
    }
  }
  
  const romanPattern = /^\(([ivxlcdm]+)\)\s*/i
  const optionPattern = /^\(([a-d])\)\s*/i
  
  let currentMCQ: Partial<ParsedQuestion> | null = null
  let questionCounter = 0
  let collectingForCurrentQuestion = false
  
  for (const element of allElements) {
    // Handle tables - add them to current question if exists
    if (element.tagName === 'TABLE') {
      if (currentMCQ) {
        const tableHtml = element.outerHTML;
        currentMCQ.text = (currentMCQ.text || '') + '\n\n' + convertDataUrlsToBlobUrls(tableHtml) + '\n'
      }
      continue
    }
    
    // Handle images - add them to current question if exists
    if (element.tagName === 'IMG') {
      if (currentMCQ) {
        const imgHtml = element.outerHTML;
        currentMCQ.text = (currentMCQ.text || '') + '\n' + convertDataUrlsToBlobUrls(imgHtml) + '\n'
      }
      continue
    }
    
    // Handle figure/image containers
    if (element.tagName === 'FIGURE') {
      if (currentMCQ) {
        const figureHtml = element.outerHTML;
        currentMCQ.text = (currentMCQ.text || '') + '\n' + convertDataUrlsToBlobUrls(figureHtml) + '\n'
      }
      continue
    }
    
    // Handle paragraphs
    if (element.tagName === 'P') {
      const text = element.textContent?.trim() || ''
      
      // Check options FIRST (before roman numerals)
      const optionMatch = text.match(optionPattern)
      if (optionMatch && currentMCQ && collectingForCurrentQuestion) {
        // Preserve HTML for option (may contain images, math, etc.)
        const innerHTML = element.innerHTML.replace(optionPattern, '').trim()
        const optionText = text.replace(optionPattern, '').trim()
        currentMCQ.text = (currentMCQ.text || '') + `\n(${optionMatch[1]}) ${innerHTML || optionText}`
        continue
      }
      
      // Check for question (roman numeral)
      const romanMatch = text.match(romanPattern)
      if (romanMatch) {
        // Save previous MCQ
        if (currentMCQ && currentMCQ.text) {
          questionCounter++
          const uniqueId = generateUniqueQuestionId('A', sectionIndex, questionCounter)
          mcqs.push({
            id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
            uniqueId,
            number: questionCounter,
            displayNumber: `(${currentMCQ.displayNumber})`,
            text: currentMCQ.text.trim(),
            marks: currentMCQ.marks || 1,
            type: 'mcq',
            section: currentMCQ.section || ''
          })
        }
        
        // Create new MCQ - preserve HTML for question text
        const innerHTML = element.innerHTML.replace(romanPattern, '').trim()
        const questionText = text.replace(romanPattern, '').trim()
        currentMCQ = {
          displayNumber: romanMatch[1],
          text: innerHTML || questionText,
          marks: 1,
          type: 'mcq'
        }
        collectingForCurrentQuestion = true
      }
    }
    
    // Handle any other HTML elements (div, span, etc.) that might contain images/content
    if (currentMCQ && element.tagName !== 'P' && element.tagName !== 'TABLE' && element.tagName !== 'IMG' && element.tagName !== 'FIGURE') {
      // Add the element if it has meaningful content or children
      if (element.textContent?.trim() || element.querySelector('img, table')) {
        const elementHtml = element.outerHTML;
        currentMCQ.text = (currentMCQ.text || '') + '\n' + convertDataUrlsToBlobUrls(elementHtml) + '\n'
      }
    }
  }
  
  // Push last MCQ
  if (currentMCQ && currentMCQ.text) {
    questionCounter++
    const uniqueId = generateUniqueQuestionId('A', sectionIndex, questionCounter)
    mcqs.push({
      id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
      uniqueId,
      number: questionCounter,
      displayNumber: `(${currentMCQ.displayNumber})`,
      text: currentMCQ.text,
      marks: currentMCQ.marks || 1,
      type: 'mcq',
      section: currentMCQ.section || ''
    })
  }
  
  return mcqs
}

/**
 * Parse fill-in-the-blank questions from HTML content
 * Preserves images, tables, and HTML formatting
 */
function parseFillInBlanks(contentHtmlArray: string[], sectionIndex: number): ParsedQuestion[] {
  const contentHtml = contentHtmlArray.join('\n')
  const parser = new DOMParser()
  const doc = parser.parseFromString(contentHtml, 'text/html')
  
  const questions: ParsedQuestion[] = []
  
  // Get all elements - recursively extract from wrappers
  let allElements = Array.from(doc.body.children)
  while (allElements.length === 1 && ['BLOCKQUOTE', 'DIV', 'SECTION'].includes(allElements[0].tagName)) {
    if (allElements[0].children.length > 0) {
      allElements = Array.from(allElements[0].children)
    } else {
      break
    }
  }
  
  console.log(`🔍 Fill in the Blanks: ${allElements.length} elements after unwrapping`)
  if (allElements.length <= 25) {
    allElements.forEach((el, i) => {
      const text = el.textContent?.trim().substring(0, 100) || ''
      console.log(`  ${i}: ${el.tagName} - "${text}"`)
    })
  } else {
    // Show first 15 elements
    allElements.slice(0, 15).forEach((el, i) => {
      const text = el.textContent?.trim().substring(0, 100) || ''
    })
  }

  const questionPattern = /^(\d+)\.\s*/  // Changed from roman numerals to numbers
  let questionCounter = 0
  let currentQuestion: Partial<ParsedQuestion> | null = null
  
  for (const element of allElements) {
    // Handle tables - add them to current question if exists
    if (element.tagName === 'TABLE') {
      if (currentQuestion) {
        const tableHtml = element.outerHTML;
        currentQuestion.text = (currentQuestion.text || '') + '\n\n' + convertDataUrlsToBlobUrls(tableHtml) + '\n'
      }
      continue
    }
    
    // Handle images - add them to current question if exists
    if (element.tagName === 'IMG') {
      if (currentQuestion) {
        const imgHtml = element.outerHTML;
        currentQuestion.text = (currentQuestion.text || '') + '\n' + convertDataUrlsToBlobUrls(imgHtml) + '\n'
      }
      continue
    }
    
    // Handle figure/image containers
    if (element.tagName === 'FIGURE') {
      if (currentQuestion) {
        const figureHtml = element.outerHTML;
        currentQuestion.text = (currentQuestion.text || '') + '\n' + convertDataUrlsToBlobUrls(figureHtml) + '\n'
      }
      continue
    }
    
    // Handle blockquotes (code blocks in fill in the blanks)
    if (element.tagName === 'BLOCKQUOTE') {
      if (currentQuestion) {
        currentQuestion.text = (currentQuestion.text || '') + '\n' + element.outerHTML + '\n'
      }
      continue
    }
    
    // Handle paragraphs
    if (element.tagName === 'P') {
      const text = element.textContent?.trim() || ''
      const questionMatch = text.match(questionPattern)
      
      if (questionMatch) {
        // Save previous question
        if (currentQuestion && currentQuestion.text) {
          questions.push(currentQuestion as ParsedQuestion)
        }
        
        questionCounter++
        const questionNumber = parseInt(questionMatch[1])
        // Preserve HTML for question text
        const innerHTML = element.innerHTML.replace(questionPattern, '').trim()
        const uniqueId = generateUniqueQuestionId('A', sectionIndex, questionCounter)
        
        currentQuestion = {
          id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
          uniqueId,
          number: questionNumber,
          displayNumber: questionNumber.toString(),
          text: innerHTML,
          marks: 1,
          type: 'short',
          section: 'Fill in the Blanks'
        }
      } else if (currentQuestion) {
        // Append to current question
        currentQuestion.text = (currentQuestion.text || '') + '\n' + element.innerHTML
      }
    }
    
    // Handle any other HTML elements that might contain images/content
    if (currentQuestion && element.tagName !== 'P' && element.tagName !== 'TABLE' && element.tagName !== 'IMG' && element.tagName !== 'FIGURE') {
      if (element.textContent?.trim() || element.querySelector('img, table')) {
        currentQuestion.text = (currentQuestion.text || '') + '\n' + element.outerHTML + '\n'
      }
    }
  }
  
  // Push last question
  if (currentQuestion && currentQuestion.text) {
    questions.push(currentQuestion as ParsedQuestion)
  }
  
  return questions
}

/**
 * Parse regular questions from HTML content
 * Preserves images, tables, and HTML formatting
 */
function parseRegularQuestions(contentHtmlArray: string[], sectionIndex: number): ParsedQuestion[] {
  const contentHtml = contentHtmlArray.join('\n')
  const parser = new DOMParser()
  const doc = parser.parseFromString(contentHtml, 'text/html')
  
  const questions: ParsedQuestion[] = []
  
  // Get all elements - recursively extract from wrappers
  let allElements = Array.from(doc.body.children)
  while (allElements.length === 1 && ['BLOCKQUOTE', 'DIV', 'SECTION'].includes(allElements[0].tagName)) {
    if (allElements[0].children.length > 0) {
      allElements = Array.from(allElements[0].children)
    } else {
      break
    }
  }
  
  const questionPattern = /^(\d+)\.\s*/
  let questionCounter = 0
  let currentQuestion: Partial<ParsedQuestion> | null = null
  let currentQuestionNumber = 0 // Track the current question number to detect subparts
  let preQuestionContent: string[] = [] // Collect content before first question
  
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i]
    // Handle tables - add them to current question if exists, else collect
    if (element.tagName === 'TABLE') {
      const tableHtml = element.outerHTML;
      const converted = convertDataUrlsToBlobUrls(tableHtml);
      if (currentQuestion) {
        currentQuestion.text = (currentQuestion.text || '') + '\n\n' + converted + '\n'
      } else {
        preQuestionContent.push(converted)
      }
      continue
    }
    
    // Handle images - add them to current question if exists, else collect
    if (element.tagName === 'IMG') {
      const imgHtml = element.outerHTML;
      const converted = convertDataUrlsToBlobUrls(imgHtml);
      if (currentQuestion) {
        currentQuestion.text = (currentQuestion.text || '') + '\n' + converted + '\n'
      } else {
        preQuestionContent.push(converted)
      }
      continue
    }
    
    // Handle figure/image containers
    if (element.tagName === 'FIGURE') {
      const figureHtml = element.outerHTML;
      const converted = convertDataUrlsToBlobUrls(figureHtml);
      if (currentQuestion) {
        currentQuestion.text = (currentQuestion.text || '') + '\n' + converted + '\n'
      } else {
        preQuestionContent.push(converted)
      }
      continue
    }
    
    // Handle paragraphs
    if (element.tagName === 'P') {
      const text = element.textContent?.trim() || ''
      const questionMatch = text.match(questionPattern)
      
      if (questionMatch) {
        const questionNumber = parseInt(questionMatch[1])
        
        // Check if this is actually a subpart (nested numbering like 45) a) 1))
        // If the number is less than or equal to the current question number, it's a subpart
        const isSubpart = currentQuestionNumber > 0 && questionNumber <= currentQuestionNumber
        
        if (isSubpart) {
          // This is a subpart, not a new question - add it to current question
          if (currentQuestion) {
            const paragraphHtml = element.outerHTML;
            currentQuestion.text = (currentQuestion.text || '') + '\n' + convertDataUrlsToBlobUrls(paragraphHtml)
          }
          continue
        }
        
        // Save previous question
        if (currentQuestion && currentQuestion.text) {
          questions.push(currentQuestion as ParsedQuestion)
        }
        
        questionCounter++
        currentQuestionNumber = questionNumber // Update current question number
        // Preserve HTML for question text
        const innerHTML = element.innerHTML.replace(questionPattern, '').trim()
        let marksData = extractMarks(innerHTML)
        
        // Extract difficulty level info (CO, Bloom's, Question Type)
        const difficultyInfo = extractDifficultyInfo(innerHTML)
        
        // If marks not found in current element, check the next element for <p><strong>marks</strong></p>
        if (marksData.marks === 1 && i + 1 < allElements.length) {
          const nextElement = allElements[i + 1]
          if (nextElement.tagName === 'P') {
            const nextHtml = nextElement.innerHTML
            const testMarks = extractMarks(nextHtml)
            if (testMarks.marks > 1 || testMarks.calculation) {
              marksData = testMarks
              // DON'T skip the next element - let it be added to question text
            }
          }
        }
        
        const uniqueId = generateUniqueQuestionId('GENERAL', sectionIndex, questionCounter)
        
        // If this is the first question and we have pre-question content (images/tables), prepend it
        const preContent = preQuestionContent.length > 0 ? preQuestionContent.join('') : ''
        preQuestionContent = [] // Clear after using
        
        currentQuestion = {
          id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
          uniqueId,
          number: questionNumber,
          displayNumber: questionNumber.toString(),
          text: preContent + difficultyInfo.cleanedHtml,
          marks: marksData.marks === 1 ? 12 : marksData.marks, // Default to 12 marks if only 1 (default value)
          type: (marksData.marks === 1 ? 12 : marksData.marks) >= 10 ? 'long' : 'short',
          section: '',
          ...(marksData.calculation && { marksDistribution: marksData.calculation }),
          ...(difficultyInfo.courseOutcome && { courseOutcome: difficultyInfo.courseOutcome }),
          ...(difficultyInfo.bloomsLevel && { bloomsLevel: difficultyInfo.bloomsLevel }),
          ...(difficultyInfo.questionType && { questionType: difficultyInfo.questionType })
        }
      } else if (currentQuestion) {
        // Append HTML to current question - preserve full HTML structure with paragraph tags
        if (text || element.querySelector('img, table')) {
          const paragraphHtml = element.outerHTML;
          currentQuestion.text = (currentQuestion.text || '') + '\n' + convertDataUrlsToBlobUrls(paragraphHtml)
        }
      } else if (!currentQuestion) {
        // Before first question - collect paragraphs with images/tables
        if (element.querySelector('img, table')) {
          preQuestionContent.push(convertDataUrlsToBlobUrls(element.outerHTML))
        }
      }
    }
    
    // Handle any other HTML elements that might contain images/content
    if (currentQuestion && element.tagName !== 'P' && element.tagName !== 'TABLE' && element.tagName !== 'IMG' && element.tagName !== 'FIGURE') {
      if (element.textContent?.trim() || element.querySelector('img, table')) {
        const elementHtml = element.outerHTML;
        currentQuestion.text = (currentQuestion.text || '') + '\n' + convertDataUrlsToBlobUrls(elementHtml) + '\n'
      }
    } else if (!currentQuestion && element.tagName !== 'P') {
      // Collect non-paragraph elements before first question
      if (element.textContent?.trim() || element.querySelector('img, table')) {
        preQuestionContent.push(element.outerHTML)
      }
    }
  }
  
  // Push last question
  if (currentQuestion && currentQuestion.text) {
    questions.push(currentQuestion as ParsedQuestion)
  }
  
  return questions
}

/**
 * Extract text from HTML while preserving structure for math and tables
 */
function extractStructuredText(element: HTMLElement): string {
  let text = ''
  
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent?.trim()
      if (textContent) {
        text += textContent + ' '
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elementNode = node as HTMLElement
      const tagName = elementNode.tagName.toLowerCase()
      
      // Preserve table HTML structure
      if (tagName === 'table') {
        text += '\n[TABLE]\n' + elementNode.outerHTML + '\n[/TABLE]\n'
      }
      // Preserve math content (MathML from pandoc)
      else if (tagName === 'math' || elementNode.classList?.contains('math')) {
        text += '\n[MATH]' + elementNode.outerHTML + '[/MATH]\n'
      }
      // Preserve images with their HTML
      else if (tagName === 'img') {
        text += '\n[IMAGE]' + elementNode.outerHTML + '[/IMAGE]\n'
      }
      // Handle line breaks
      else if (tagName === 'br') {
        text += '\n'
      }
      // Handle paragraphs and divs with line breaks
      else if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const content = extractStructuredText(elementNode).trim()
        if (content) {
          text += '\n' + content + '\n'
        }
      }
      // Handle lists with proper formatting
      else if (tagName === 'li') {
        text += '\n• ' + extractStructuredText(elementNode) + '\n'
      }
      // Preserve strong/bold formatting as HTML
      else if (['strong', 'b'].includes(tagName)) {
        text += '<strong>' + extractStructuredText(elementNode) + '</strong>'
      }
      // Preserve emphasis/italic as HTML
      else if (['em', 'i'].includes(tagName)) {
        text += '<em>' + extractStructuredText(elementNode) + '</em>'
      }
      // Default case - continue processing children
      else {
        text += extractStructuredText(elementNode)
      }
    }
  }
  
  return text.replace(/\n\s*\n\s*\n/g, '\n\n').trim()
}

/**
 * Extract text from table elements preserving complete structure (kept for future use)
 */
function extractTableText(table: HTMLElement): string {
  let tableText = ''
  const rows = table.querySelectorAll('tr')
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td, th')
    const cellTexts: string[] = []
    
    cells.forEach(cell => {
      const cellContent = extractStructuredText(cell as HTMLElement).trim()
      cellTexts.push(cellContent || '')
    })
    
    if (cellTexts.some(text => text.length > 0)) {
      if (rowIndex === 0 && row.querySelector('th')) {
        tableText += '| ' + cellTexts.join(' | ') + ' |\n'
        tableText += '|' + cellTexts.map(() => ' --- ').join('|') + '|\n'
      } else {
        tableText += '| ' + cellTexts.join(' | ') + ' |\n'
      }
    }
  })
  
  return tableText.trim()
}

function toRomanNumeral(num: number): string {
  const values = [10, 9, 5, 4, 1]
  const literals = ['x', 'ix', 'v', 'iv', 'i']
  
  let result = ''
  for (let i = 0; i < values.length; i++) {
    while (num >= values[i]) {
      result += literals[i]
      num -= values[i]
    }
  }
  return result
}

/**
 * Extract marks from HTML containing <p><strong> tags with calculations
 * Returns both the calculation string and the total marks value
 */
function extractMarks(html: string): { marks: number; calculation?: string } {
  // First try to extract from <p><strong>...</strong></p> or <strong>...</strong> pattern
  const strongPattern = /<strong>\s*([^<]+)\s*<\/strong>/i
  const strongMatch = html.match(strongPattern)
  
  if (strongMatch) {
    const strongContent = strongMatch[1].trim()
    
    // Look for calculation with = sign (e.g., "(2 + 2 + 2+2) + 4 = 12")
    const calcPattern = /([\d+\-×\*\/\(\)\s]+)\s*=\s*(\d+)/
    const calcMatch = strongContent.match(calcPattern)
    
    if (calcMatch) {
      const calculation = calcMatch[1].trim()
      const total = Number.parseInt(calcMatch[2])
      return { marks: total, calculation: `${calculation} = ${total}` }
    }
  }
  
  // Fallback: Try text-based patterns
  const patterns = [
    /\[(\d+)\s*marks?\]/i,                           // [5 marks]
    /\$\$(\d+)\s*marks?\$\$/i,                       // $$5 marks$$
    /([\d+\-×\*\/\(\)\s]+)\s*=\s*(\d+)/,            // Any calculation = number
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      if (pattern.source.includes('=')) {
        const calculation = match[1].trim()
        const total = Number.parseInt(match[2])
        return { marks: total, calculation: `${calculation} = ${total}` }
      } else {
        return { marks: Number.parseInt(match[1]) }
      }
    }
  }

  return { marks: 1 } // Default marks
}

/**
 * Extract difficulty level information from question text
 * Format: [(CO1)(Understand/LOCQ)] or similar patterns
 */
function extractDifficultyInfo(html: string): { 
  courseOutcome?: string; 
  bloomsLevel?: string; 
  questionType?: string;
  cleanedHtml: string;
} {
  // Pattern to match formats like:
  // [(CO1)(Understand/LOCQ)]
  // [(CO2)(Apply/HOCQ)]
  // [CO3, Understand, LOCQ]
  const difficultyPattern = /\[?\(?(CO\s*[1-4])\)?\s*[\(,]?\s*([^\/\),]+)?\s*[\/,]?\s*([^\])\s]+)?\s*\)?\]?/i
  
  const match = html.match(difficultyPattern)
  
  if (match) {
    const co = match[1]?.replace(/\s/g, '').toUpperCase() // CO1, CO2, etc.
    const bloomsLevel = match[2]?.trim() // Understand, Apply, etc.
    const questionType = match[3]?.trim() // LOCQ, HOCQ, MCQ, etc.
    
    // Remove the difficulty marker from HTML
    const cleanedHtml = html.replace(match[0], '').trim()
    
    return {
      courseOutcome: co,
      bloomsLevel: bloomsLevel,
      questionType: questionType,
      cleanedHtml
    }
  }
  
  return { cleanedHtml: html }
}

/**
 * Clean question text by removing only old/legacy marks formats
 * Preserves: <p><strong>marks calculations</strong></p> and <em>[metadata]</em>
 */
function cleanQuestionText(text: string): string {
  const marksPatterns = [
    /\[(\d+)\s*marks?\]/gi,                         // [5 marks] - old format only
    /\$\$(\d+)\s*marks?\$\$/gi,                     // $$5 marks$$ - old format only
  ]

  let cleaned = text
  marksPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })

  return cleaned.trim()
}

/**
 * Parse a DOCX file and extract questions in a structured format
 * Uses Pandoc when available for better math/table/image support, falls back to Mammoth
 */
export async function parseDocxFile(file: File): Promise<{ sections: Section[], header: ParsedHeader | null }> {
  try {
    // Convert DOCX to HTML using Pandoc or Mammoth
    let htmlContent = await convertDocxToHtml(file)
    
    // Save HTML output for debugging
    console.log('=== HTML Output from Conversion ===')
    console.log('First 2000 characters:')
    console.log(htmlContent.substring(0, 2000))
    console.log('\n=== End of Preview ===')
    
    // Extract header information before parsing the main content
    const parsedHeader = parseQuestionPaperHeader(htmlContent)
    console.log('Parsed header:', parsedHeader)
    
    // Remove header content from HTML to avoid duplication in questions
    if (parsedHeader) {
      htmlContent = removeHeaderFromHTML(htmlContent, parsedHeader)
      console.log('Header removed from HTML content')
    }
    
    // Save to localStorage for inspection
    try {
      localStorage.setItem('last_parsed_html', htmlContent)
      if (parsedHeader) {
        localStorage.setItem('last_parsed_header', JSON.stringify(parsedHeader))
      }
      console.log('Full HTML saved to localStorage as "last_parsed_html"')
      console.log('To view: localStorage.getItem("last_parsed_html")')
    } catch (e) {
      console.warn('Could not save to localStorage:', e)
    }
    
    // Parse the HTML content
    const sections = parseHtmlContent(htmlContent)
    return { sections, header: parsedHeader }
  } catch (error) {
    throw new Error("Failed to parse DOCX file. Make sure it's a valid Word document.")
  }
}

