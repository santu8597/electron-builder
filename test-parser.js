// Test script to verify parser logic
const fs = require('fs').promises;
const { JSDOM } = require('jsdom');

async function testParser() {
  console.log('Testing parser logic...\n');
  
  // Simulate a simple HTML with Group A, B, C MCQs
  const testHtml = `
    <html>
      <body>
        <p><strong>GROUP – A</strong></p>
        <p><strong>Module 1 – Introduction</strong></p>
        <p>(i) What is JavaScript?</p>
        <p>(a) A programming language</p>
        <p>(b) A markup language</p>
        <p>(c) A database</p>
        <p>(d) A framework</p>
        <p>(ii) What does HTML stand for?</p>
        <p>(a) Hyper Text Markup Language</p>
        <p>(b) High Tech Modern Language</p>
        <p>(c) Home Tool Markup Language</p>
        <p>(d) Hyperlinks and Text Markup Language</p>
        
        <p><strong>GROUP – B</strong></p>
        <p><strong>Module 2 – Advanced Topics</strong></p>
        <p>(i) Explain closures in JavaScript.</p>
        <p>(a) Functions within functions</p>
        <p>(b) Loops in arrays</p>
        <p>(c) Database connections</p>
        <p>(d) CSS selectors</p>
        
        <p><strong>GROUP – C</strong></p>
        <p>1. Describe the MVC architecture.</p>
        
        <p><strong>GROUP – D</strong></p>
        <p>1. Write a program to sort an array.</p>
        
        <p><strong>GROUP – E</strong></p>
        <p>1. Implement a linked list data structure.</p>
      </body>
    </html>
  `;
  
  const dom = new JSDOM(testHtml);
  const doc = dom.window.document;
  
  // Test group detection
  console.log('=== Testing Group Detection ===');
  const children = Array.from(doc.body.children);
  const groups = [];
  
  for (const element of children) {
    if (element.tagName === 'P') {
      const strongTag = element.querySelector('strong');
      if (strongTag) {
        const text = strongTag.textContent.trim();
        if (text.match(/^GROUP\s*[–-]?\s*[A-E]/i) || text.startsWith('GROUP')) {
          console.log(`Found group: "${text}"`);
          groups.push(text);
        }
      }
    }
  }
  
  console.log(`\nTotal groups found: ${groups.length}`);
  console.log('Groups:', groups);
  
  // Test MCQ parsing
  console.log('\n=== Testing MCQ Parsing ===');
  const romanPattern = /^\(([ivxlcdm]+)\)\s*/i;
  const optionPattern = /^\(([a-d])\)\s*/i;
  
  let mcqCount = 0;
  let optionCount = 0;
  
  for (const element of children) {
    if (element.tagName === 'P') {
      const text = element.textContent.trim();
      
      if (text.match(optionPattern)) {
        optionCount++;
        console.log(`Option: ${text.substring(0, 50)}...`);
      } else if (text.match(romanPattern)) {
        mcqCount++;
        console.log(`MCQ: ${text.substring(0, 50)}...`);
      }
    }
  }
  
  console.log(`\nTotal MCQs found: ${mcqCount}`);
  console.log(`Total options found: ${optionCount}`);
  
  console.log('\n=== Test Complete ===');
}

testParser().catch(console.error);
