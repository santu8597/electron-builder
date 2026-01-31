import type { Section, ParsedQuestion } from "@/app/page"

/**
 * Dedicated parser for GROUP A MCQs and Fill in the Blanks
 * Based on functions/regex.js approach
 */

interface GroupAModule {
  title: string
  content: string[]
  isMCQ: boolean
  isFillInBlanks: boolean
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
 * Parse GROUP A structure and extract modules
 */
export function parseGroupA(html: string): Section[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  const sections: Section[] = []
  const modules: GroupAModule[] = []
  let currentModule: GroupAModule | null = null
  let isInGroupA = false
  
  const children = Array.from(doc.body.children)
  
  for (const element of children) {
    if (element.tagName === 'P') {
      const strongTag = element.querySelector('strong')
      
      if (strongTag) {
        const text = strongTag.textContent?.trim() || ''
        
        // Check for GROUP A heading (various formats: GROUP – A, GROUP - A, GROUP A, GROUP–A)
        if (text.startsWith('GROUP') && (text.includes('A') || text.match(/GROUP\s*[–-]?\s*A/i))) {
          isInGroupA = true
          currentModule = null
          continue
        }
        
        // Check for other groups - stop processing
        if (text.startsWith('GROUP') && !text.match(/GROUP\s*[–-]?\s*A/i)) {
          break
        }
        
        // Check for MODULE heading within GROUP A
        if (isInGroupA && text.startsWith('Module')) {
          // Save previous module
          if (currentModule) {
            modules.push(currentModule)
          }
          
          currentModule = {
            title: text,
            content: [],
            isMCQ: true,
            isFillInBlanks: false
          }
          continue
        }
        
        // Check for FILL IN THE GAPS/BLANKS heading
        if (isInGroupA && (text.includes('FILL IN THE') || text === 'FILL IN THE GAPS')) {
          // Save previous module
          if (currentModule) {
            modules.push(currentModule)
          }
          
          currentModule = {
            title: 'Fill in the Blanks',
            content: [],
            isMCQ: false,
            isFillInBlanks: true
          }
          continue
        }
      }
    }
    
    // Add content to current module
    if (isInGroupA && currentModule) {
      currentModule.content.push(element.outerHTML)
    }
  }
  
  // Push last module
  if (currentModule && currentModule.content.length > 0) {
    modules.push(currentModule)
  }
  
  // Convert modules to sections
  modules.forEach((module, index) => {
    if (module.isFillInBlanks) {
      const questions = parseFillInBlanksQuestions(module.content, index).map(q => ({ ...q, group: 'A' }))
      sections.push({
        id: `section-group-a-${index}`,
        title: `Group A - ${module.title}`,
        instructions: 'Fill in the blanks with appropriate answers',
        questions
      })
    } else if (module.isMCQ) {
      const questions = parseMCQQuestions(module.content, index).map(q => ({ ...q, group: 'A' }))
      sections.push({
        id: `section-group-a-${index}`,
        title: `Group A - ${module.title}`,
        instructions: 'Multiple Choice Questions - Choose the correct alternative',
        questions
      })
    }
  })
  
  return sections
}

/**
 * Parse MCQ questions from module content
 * Preserves HTML including images, tables, math
 */
export function parseMCQQuestions(contentHtmlArray: string[], sectionIndex: number): ParsedQuestion[] {
  const contentHtml = contentHtmlArray.join('\n')
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(contentHtml, 'text/html')
  
  const mcqs: ParsedQuestion[] = []
  
  // Unwrap nested divs/sections if content is wrapped
  let allElements = Array.from(doc.body.children)
  
  // If we only have 1 element and it's a container, unwrap it
  if (allElements.length === 1 && ['DIV', 'SECTION', 'BLOCKQUOTE'].includes(allElements[0].tagName)) {
    allElements = Array.from(allElements[0].children)
  }
  
  const romanPattern = /^\(([ivxlcdm]+)\)\s*/i
  const optionPattern = /^\(([a-d])\)\s*/i
  
  let currentMCQ: Partial<ParsedQuestion> | null = null
  let questionCounter = 0
  let preQuestionContent: string[] = [] // Collect content before first question
  
  for (const element of allElements) {
    // Handle tables - add to current question or collect if no question yet
    if (element.tagName === 'TABLE') {
      const tableHtml = element.outerHTML;
      const converted = convertDataUrlsToBlobUrls(tableHtml);
      if (currentMCQ) {
        currentMCQ.text = (currentMCQ.text || '') + '\n\n' + converted + '\n'
      } else {
        preQuestionContent.push(converted)
      }
      continue
    }
    
    // Handle images - add to current question or collect if no question yet
    if (element.tagName === 'IMG') {
      const imgHtml = element.outerHTML;
      const convertedHtml = convertDataUrlsToBlobUrls(imgHtml);
      if (currentMCQ) {
        currentMCQ.text = (currentMCQ.text || '') + '\n' + convertedHtml + '\n'
      } else {
        preQuestionContent.push(convertedHtml)
      }
      continue
    }
    
    // Handle figure/image containers - add to current question or collect if no question yet
    if (element.tagName === 'FIGURE') {
      const figureHtml = element.outerHTML;
      const convertedHtml = convertDataUrlsToBlobUrls(figureHtml);
      if (currentMCQ) {
        currentMCQ.text = (currentMCQ.text || '') + '\n' + convertedHtml + '\n'
      } else {
        preQuestionContent.push(convertedHtml)
      }
      continue
    }
    
    // Handle paragraphs
    if (element.tagName === 'P') {
      const text = element.textContent?.trim() || ''
      
      // Check options FIRST (before roman numerals, since 'c' and 'd' contain roman chars)
      const optionMatch = text.match(optionPattern)
      if (optionMatch && currentMCQ) {
        // Keep the option marker (a), (b), etc. in the HTML
        currentMCQ.text = (currentMCQ.text || '') + '\n' + element.outerHTML
        continue
      }
      
      // Check for question (roman numeral)
      const romanMatch = text.match(romanPattern)
      if (romanMatch) {
        // Save previous MCQ
        if (currentMCQ && currentMCQ.text) {
          questionCounter++
          const uniqueId = `A-mcq-s${sectionIndex}-q${questionCounter}`
          const difficultyInfo = extractDifficultyInfo(currentMCQ.text.trim())
          const mcq = {
            id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
            uniqueId,
            number: questionCounter,
            displayNumber: `(${currentMCQ.displayNumber})`,
            text: difficultyInfo.cleanedHtml,
            marks: currentMCQ.marks || 1,
            type: 'mcq' as const,
            section: 'Group A MCQ',
            ...(difficultyInfo.courseOutcome && { courseOutcome: difficultyInfo.courseOutcome }),
            ...(difficultyInfo.bloomsLevel && { bloomsLevel: difficultyInfo.bloomsLevel }),
            ...(difficultyInfo.questionType && { questionType: difficultyInfo.questionType })
          }
          mcqs.push(mcq)
        }
        
        // Create new MCQ - remove roman numeral from innerHTML
        const cleanedInnerHTML = element.innerHTML.replace(romanPattern, '')
        
        // If this is the first question and we have pre-question content (images, tables), add it
        let initialText = cleanedInnerHTML + '\n'
        if (questionCounter === 0 && preQuestionContent.length > 0) {
          initialText = preQuestionContent.join('\n') + '\n' + initialText
          preQuestionContent = [] // Clear after using
        }
        
        currentMCQ = {
          displayNumber: romanMatch[1],
          text: initialText,
          marks: 1,
          type: 'mcq'
        }
        continue
      }
      
      // If paragraph doesn't match option or roman pattern, add it to current question
      if (currentMCQ) {
        currentMCQ.text = (currentMCQ.text || '') + '\n' + convertDataUrlsToBlobUrls(element.outerHTML)
      }
    }
    
    // Handle any other content that's not a paragraph (div, etc.)
    if (currentMCQ && element.tagName !== 'P') {
      currentMCQ.text = (currentMCQ.text || '') + '\n' + convertDataUrlsToBlobUrls(element.outerHTML) + '\n'
    }
  }
  
  // Push last MCQ
  if (currentMCQ && currentMCQ.text) {
    questionCounter++
    const uniqueId = `A-mcq-s${sectionIndex}-q${questionCounter}`
    const difficultyInfo = extractDifficultyInfo(currentMCQ.text.trim())
    const mcq = {
      id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
      uniqueId,
      number: questionCounter,
      displayNumber: `(${currentMCQ.displayNumber})`,
      text: difficultyInfo.cleanedHtml,
      marks: currentMCQ.marks || 1,
      type: 'mcq' as const,
      section: 'Group A MCQ',
      ...(difficultyInfo.courseOutcome && { courseOutcome: difficultyInfo.courseOutcome }),
      ...(difficultyInfo.bloomsLevel && { bloomsLevel: difficultyInfo.bloomsLevel }),
      ...(difficultyInfo.questionType && { questionType: difficultyInfo.questionType })
    }
    mcqs.push(mcq)
  }
  
  return mcqs
}

/**
 * Parse Fill in the Blanks questions from module content
 * Preserves HTML including images, tables, math
 */
export function parseFillInBlanksQuestions(contentHtmlArray: string[], sectionIndex: number): ParsedQuestion[] {
  const contentHtml = contentHtmlArray.join('\n')
  const parser = new DOMParser()
  const doc = parser.parseFromString(contentHtml, 'text/html')
  
  const questions: ParsedQuestion[] = []
  
  // Unwrap nested containers if content is wrapped
  let allElements = Array.from(doc.body.children)
  
  // If we only have 1 element and it's a container, unwrap it
  if (allElements.length === 1 && ['DIV', 'SECTION', 'BLOCKQUOTE'].includes(allElements[0].tagName)) {
    allElements = Array.from(allElements[0].children)
  }
  
  // Fill-in-blanks use numbered format: 1., 2., 3., etc.
  const numberPattern = /^(\d+)\.\s*/
  let questionCounter = 0
  let currentQuestion: Partial<ParsedQuestion> | null = null
  let preQuestionContent: string[] = [] // Collect content before first question
  
  for (const element of allElements) {
    // Handle tables - add to current question or collect if no question yet
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
    
    // Handle images - add to current question or collect if no question yet
    if (element.tagName === 'IMG') {
      const imgHtml = element.outerHTML;
      const convertedHtml = convertDataUrlsToBlobUrls(imgHtml);
      if (currentQuestion) {
        currentQuestion.text = (currentQuestion.text || '') + '\n' + convertedHtml + '\n'
      } else {
        preQuestionContent.push(convertedHtml)
      }
      continue
    }
    
    // Handle figure/image containers - add to current question or collect if no question yet
    if (element.tagName === 'FIGURE') {
      const figureHtml = element.outerHTML;
      const convertedHtml = convertDataUrlsToBlobUrls(figureHtml);
      if (currentQuestion) {
        currentQuestion.text = (currentQuestion.text || '') + '\n' + convertedHtml + '\n'
      } else {
        preQuestionContent.push(convertedHtml)
      }
      continue
    }
    
    // Handle paragraphs
    if (element.tagName === 'P') {
      const text = element.textContent?.trim() || ''
      const numberMatch = text.match(numberPattern)
      
      if (numberMatch) {
        // Save previous question
        if (currentQuestion && currentQuestion.text) {
          const difficultyInfo = extractDifficultyInfo(currentQuestion.text)
          const questionWithDifficulty = {
            ...currentQuestion,
            text: difficultyInfo.cleanedHtml,
            ...(difficultyInfo.courseOutcome && { courseOutcome: difficultyInfo.courseOutcome }),
            ...(difficultyInfo.bloomsLevel && { bloomsLevel: difficultyInfo.bloomsLevel }),
            ...(difficultyInfo.questionType && { questionType: difficultyInfo.questionType })
          }
          questions.push(questionWithDifficulty as ParsedQuestion)
        }
        
        questionCounter++
        // Remove the number from innerHTML
        const cleanedInnerHTML = element.innerHTML.replace(numberPattern, '')
        const uniqueId = `A-fib-s${sectionIndex}-q${questionCounter}`
        
        // If this is the first question and we have pre-question content (images, tables), add it
        let initialText = cleanedInnerHTML
        if (questionCounter === 1 && preQuestionContent.length > 0) {
          initialText = preQuestionContent.join('\n') + '\n' + initialText
          preQuestionContent = [] // Clear after using
        }
        
        currentQuestion = {
          id: `q-${Date.now()}-${sectionIndex}-${questionCounter}`,
          uniqueId,
          number: questionCounter,
          displayNumber: numberMatch[1],
          text: initialText,
          marks: 1,
          type: 'short',
          section: 'Fill in the Blanks'
        }
        continue
      }
    }
    
    // Handle any other content that's not a paragraph
    if (currentQuestion && element.tagName !== 'P') {
      currentQuestion.text = (currentQuestion.text || '') + '\n' + convertDataUrlsToBlobUrls(element.outerHTML) + '\n'
    }
  }
  
  // Push last question
  if (currentQuestion && currentQuestion.text) {
    const difficultyInfo = extractDifficultyInfo(currentQuestion.text)
    const questionWithDifficulty = {
      ...currentQuestion,
      text: difficultyInfo.cleanedHtml,
      ...(difficultyInfo.courseOutcome && { courseOutcome: difficultyInfo.courseOutcome }),
      ...(difficultyInfo.bloomsLevel && { bloomsLevel: difficultyInfo.bloomsLevel }),
      ...(difficultyInfo.questionType && { questionType: difficultyInfo.questionType })
    }
    questions.push(questionWithDifficulty as ParsedQuestion)
  }
  
  return questions
}
