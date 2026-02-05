const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function generatePandocTemplate() {
  const outputPath = path.join(__dirname, '..', 'helpers', 'pandoc-reference.docx');
  
  return new Promise((resolve, reject) => {
    console.log('Generating Pandoc reference template...');
    
    // Spawn pandoc and capture binary output
    const pandoc = spawn('pandoc', ['--print-default-data-file', 'reference.docx']);
    
    const chunks = [];
    
    pandoc.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    pandoc.stderr.on('data', (data) => {
      console.error('Pandoc error:', data.toString());
    });
    
    pandoc.on('close', (code) => {
      if (code === 0) {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(outputPath, buffer);
        
        console.log('✅ Template generated at:', outputPath);
        console.log('\n⚠️  IMPORTANT: Your current template.docx might not work!');
        console.log('\nPandoc needs these specific Word style names:');
        console.log('  • Title - Document title (auto-centered)');
        console.log('  • Subtitle - Subtitle (auto-centered)');
        console.log('  • Author - Author info (auto-centered)');
        console.log('  • Heading 2 - Section headings');
        console.log('  • Normal - Body/question text');
        console.log('\n📋 To create a proper template:');
        console.log('1. Open: helpers/pandoc-reference.docx in Word');
        console.log('2. Go to: Home → Styles pane (click arrow)');
        console.log('3. For each style (Title, Subtitle, Heading 2, Normal):');
        console.log('   - Right-click → Modify');
        console.log('   - Change font, size, spacing as desired');
        console.log('4. Save As: helpers/template.docx (replace existing)');
        console.log('5. Restart the app');
        
        resolve();
      } else {
        reject(new Error(`Pandoc exited with code ${code}`));
      }
    });
    
    pandoc.on('error', (err) => {
      reject(new Error(`Failed to start Pandoc: ${err.message}`));
    });
  });
}

generatePandocTemplate().catch(console.error);
