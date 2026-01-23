/**
 * Parses a university exam paper HTML document and organizes content by groups and modules.
 * Preserves all HTML content including MathJax equations, images, and tables exactly as-is.
 * 
 * @param {string} htmlString - The complete HTML document as a string
 * @param {boolean} isNodeJs - Set to true to use JSDOM (Node.js), false for browser DOMParser
 * @returns {Array} Array of group objects with nested modules and content
 */
function parseExamPaper(htmlString, isNodeJs = false) {
    let doc;
    
    if (isNodeJs) {
        // Node.js environment with JSDOM
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM(htmlString);
        doc = dom.window.document;
    } else {
        // Browser environment with DOMParser
        const parser = new DOMParser();
        doc = parser.parseFromString(htmlString, 'text/html');
    }
    
    const result = [];
    let currentGroup = null;
    let currentModule = null;
    
    // Iterate through all children of body in order
    const children = Array.from(doc.body.children);
    
    for (const element of children) {
        // Check if this is a paragraph with strong tag
        if (element.tagName === 'P') {
            const strongTag = element.querySelector('strong');
            
            if (strongTag) {
                const text = strongTag.textContent.trim();
                
                // Check for GROUP heading
                if (text.startsWith('GROUP')) {
                    // Save previous group if exists
                    if (currentGroup) {
                        result.push(currentGroup);
                    }
                    
                    // Create new group (will add modules or content array based on what's found)
                    currentGroup = {
                        group: text
                    };
                    currentModule = null;
                    continue;
                }
                
                // Check for MODULE heading
                if (text.startsWith('Module')) {
                    // Create new module if we have a current group
                    if (currentGroup) {
                        // Initialize modules array if not exists
                        if (!currentGroup.modules) {
                            currentGroup.modules = [];
                        }
                        currentModule = {
                            title: text,
                            content: []
                        };
                        currentGroup.modules.push(currentModule);
                    }
                    continue;
                }
                
                // Check for FILL IN THE GAPS heading (special section in GROUP A)
                if (text === 'FILL IN THE GAPS') {
                    // Create new module for fill in the blanks if we have a current group
                    if (currentGroup) {
                        // Initialize modules array if not exists
                        if (!currentGroup.modules) {
                            currentGroup.modules = [];
                        }
                        currentModule = {
                            title: 'Fill in the Blanks',
                            content: []
                        };
                        currentGroup.modules.push(currentModule);
                    }
                    continue;
                }
            }
        }
        
        // If we have a current module, add this element's outerHTML to its content
        if (currentModule) {
            currentModule.content.push(element.outerHTML);
        } 
        // If we have a group but no module, store content directly in group
        else if (currentGroup) {
            // Initialize content array if not exists
            if (!currentGroup.content) {
                currentGroup.content = [];
            }
            currentGroup.content.push(element.outerHTML);
        }
    }
    
    // Push the last group if it exists
    if (currentGroup) {
        result.push(currentGroup);
    }
    
    return result;
}


/**
 * Parse MCQs from a module's content HTML
 * Extracts questions with roman numerals and their options (a, b, c, d)
 * 
 * @param {string} contentHtml - The HTML content from a module
 * @param {boolean} isNodeJs - Whether running in Node.js environment
 * @returns {Array} Array of MCQ objects with question and options
 */
function parseMCQs(contentHtml, isNodeJs = false) {
    let doc;
    
    if (isNodeJs) {
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM(contentHtml);
        doc = dom.window.document;
    } else {
        const parser = new DOMParser();
        doc = parser.parseFromString(contentHtml, 'text/html');
    }
    
    const mcqs = [];
    const allParagraphs = Array.from(doc.body.querySelectorAll('p'));
    
    // Roman numeral pattern: (i), (ii), (iii), (iv), (v), (vi), (vii), (viii), (ix), (x), etc.
    const romanPattern = /^\(([ivxlcdm]+)\)\s*/i;
    // Option pattern: (a), (b), (c), (d) - MUST CHECK THIS FIRST!
    const optionPattern = /^\(([a-d])\)\s*/i;
    
    let currentMCQ = null;
    
    for (let i = 0; i < allParagraphs.length; i++) {
        const p = allParagraphs[i];
        const text = p.textContent.trim();
        
        // IMPORTANT: Check options BEFORE roman numerals because (c), (d) match both patterns
        const optionMatch = text.match(optionPattern);
        if (optionMatch && currentMCQ) {
            currentMCQ.options.push({
                option: optionMatch[1],
                text: text.replace(optionPattern, '').trim(),
                html: p.innerHTML
            });
            continue;
        }
        
        // Check if this is a question (starts with roman numeral)
        const romanMatch = text.match(romanPattern);
        if (romanMatch) {
            // Save previous MCQ if exists
            if (currentMCQ && currentMCQ.options.length > 0) {
                mcqs.push(currentMCQ);
            }
            
            // Create new MCQ
            currentMCQ = {
                questionNumber: romanMatch[1],
                question: text.replace(romanPattern, '').trim(),
                questionHtml: p.innerHTML,
                options: []
            };
            continue;
        }
    }
    
    // Push the last MCQ if exists
    if (currentMCQ && currentMCQ.options.length > 0) {
        mcqs.push(currentMCQ);
    }
    
    return mcqs;
}


/**
 * Parse MCQs from all modules in Group A
 * @param {Object} groupA - The Group A object from parsed data
 * @param {boolean} isNodeJs - Whether running in Node.js environment
 * @returns {Object} Group A with MCQs parsed in each module
 */
function parseGroupAMCQs(groupA, isNodeJs = false) {
    if (!groupA.modules) {
        return groupA;
    }
    
    const result = { ...groupA };
    result.modules = groupA.modules.map(module => {
        // Skip "Fill in the Blanks" module
        if (module.title === 'Fill in the Blanks') {
            return module;
        }
        
        // Parse MCQs from the module content
        const contentHtml = module.content.join('\n');
        const mcqs = parseMCQs(contentHtml, isNodeJs);
        
        return {
            ...module,
            mcqs: mcqs,
            totalMCQs: mcqs.length
        };
    });
    
    return result;
}


/**
 * Parse MCQs from the entire exam paper structure
 * @param {Array} parsedData - The parsed exam paper structure
 * @param {boolean} isNodeJs - Whether running in Node.js environment
 * @returns {Array} Parsed data with MCQs extracted for Group A
 */
function parseAllMCQs(parsedData, isNodeJs = false) {
    return parsedData.map(group => {
        if (group.group === 'GROUP – A') {
            return parseGroupAMCQs(group, isNodeJs);
        }
        return group;
    });
}


/**
 * Browser-specific wrapper function
 * Use this in browser environments
 */
function parseExamPaperBrowser(htmlString) {
    return parseExamPaper(htmlString, false);
}


/**
 * Node.js-specific wrapper function
 * Requires JSDOM: npm install jsdom
 * Use this in Node.js environments
 */
function parseExamPaperNode(htmlString) {
    return parseExamPaper(htmlString, true);
}


/**
 * Utility function to load and parse HTML from a file (Node.js only)
 * @param {string} filePath - Path to the HTML file
 * @returns {Promise<Array>} Parsed structure
 */
async function parseExamPaperFromFile(filePath) {
    const fs = require('fs').promises;
    const htmlString = await fs.readFile(filePath, 'utf-8');
    return parseExamPaperNode(htmlString);
}


/**
 * Utility function to pretty-print the parsed structure
 * @param {Array} parsedData - The parsed exam paper structure
 * @param {boolean} includeContent - Whether to include full content or just summaries
 */
function printStructure(parsedData, includeContent = false) {
    console.log('='.repeat(80));
    console.log('EXAM PAPER STRUCTURE');
    console.log('='.repeat(80));
    
    parsedData.forEach((group, groupIndex) => {
        console.log(`\n${group.group}`);
        console.log('-'.repeat(80));
        
        if (group.modules) {
            // Group has modules
            group.modules.forEach((module, moduleIndex) => {
                console.log(`  └─ ${module.title} (${module.content.length} elements)`);
                
                if (includeContent) {
                    module.content.forEach((html, contentIndex) => {
                        // Show first 100 characters of each content element
                        const preview = html.replace(/\s+/g, ' ').substring(0, 100);
                        console.log(`     ${contentIndex + 1}. ${preview}...`);
                    });
                }
            });
        } else if (group.content) {
            // Group has content directly (no modules)
            console.log(`  └─ Direct content (${group.content.length} elements)`);
            
            if (includeContent) {
                group.content.forEach((html, contentIndex) => {
                    const preview = html.replace(/\s+/g, ' ').substring(0, 100);
                    console.log(`     ${contentIndex + 1}. ${preview}...`);
                });
            }
        }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total Groups: ${parsedData.length}`);
    
    const totalModules = parsedData.reduce((sum, g) => 
        sum + (g.modules ? g.modules.length : 0), 0);
    if (totalModules > 0) {
        console.log(`Total Modules: ${totalModules}`);
    }
    
    const totalContent = parsedData.reduce((sum, g) => {
        if (g.modules) {
            return sum + g.modules.reduce((mSum, m) => mSum + m.content.length, 0);
        } else if (g.content) {
            return sum + g.content.length;
        }
        return sum;
    }, 0);
    console.log(`Total Content Elements: ${totalContent}`);
    console.log('='.repeat(80));
}


/**
 * Utility function to export parsed data to JSON file (Node.js only)
 * @param {Array} parsedData - The parsed exam paper structure
 * @param {string} outputPath - Path for the output JSON file
 */
async function exportToJSON(parsedData, outputPath) {
    const fs = require('fs').promises;
    await fs.writeFile(outputPath, JSON.stringify(parsedData, null, 2), 'utf-8');
    console.log(`Exported to: ${outputPath}`);
}


// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseExamPaper,
        parseExamPaperBrowser,
        parseExamPaperNode,
        parseExamPaperFromFile,
        printStructure,
        exportToJSON,
        parseMCQs,
        parseGroupAMCQs,
        parseAllMCQs
    };
}
