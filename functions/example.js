// ============================================================================
// EXAMPLE: How to use the exam paper parser
// ============================================================================

const {
    parseExamPaperFromFile,
    printStructure,
    exportToJSON,
    parseAllMCQs
} = require('./regex.js');

// ============================================================================
// Main usage example
// ============================================================================
(async () => {
    try {
        console.log('Starting exam paper parser...\n');
        console.log('='.repeat(80));
        
        // Parse HTML file
        const parsed = await parseExamPaperFromFile('./my.html');
        
        // Print structure overview
        printStructure(parsed, false);
        
        // Parse MCQs from Group A
        console.log('\n' + '='.repeat(80));
        console.log('PARSING MCQs FROM GROUP A');
        console.log('='.repeat(80));
        
        const parsedWithMCQs = parseAllMCQs(parsed, true);
        
        // Show MCQ summary for Group A
        const groupA = parsedWithMCQs.find(g => g.group === 'GROUP – A');
        if (groupA && groupA.modules) {
            groupA.modules.forEach(module => {
                if (module.mcqs) {
                    console.log(`\n${module.title}: ${module.totalMCQs} MCQs`);
                    module.mcqs.slice(0, 2).forEach(mcq => {
                        console.log(`  (${mcq.questionNumber}) ${mcq.question.substring(0, 60)}...`);
                        mcq.options.forEach(opt => {
                            console.log(`      (${opt.option}) ${opt.text.substring(0, 50)}...`);
                        });
                    });
                    if (module.totalMCQs > 2) {
                        console.log(`  ... and ${module.totalMCQs - 2} more MCQs`);
                    }
                }
            });
        }
        
        // Save to JSON file with MCQs
        await exportToJSON(parsedWithMCQs, './parsed-output.json');
        
        console.log('\n✅ Done! Check parsed-output.json for the full result.');
        
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('jsdom')) {
            console.error('\n❌ ERROR: JSDOM not installed');
            console.error('Please run: npm install jsdom');
        } else {
            console.error('\n❌ ERROR:', error.message);
        }
    }
})();
