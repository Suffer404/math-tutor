const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

// Check for syntax issues
try {
  // Check for syntax issues
  let braceCount = 0;
  let parenCount = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (!inString && !inTemplate) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
      } else if (char === '`') {
        inTemplate = true;
      } else if (char === '(') parenCount++;
      else if (char === ')') parenCount--;
      else if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
    } else if (inString) {
      if (char === stringChar && content[i-1] !== '\\') {
        inString = false;
      }
    } else if (inTemplate) {
      if (char === '`') {
        inTemplate = false;
      }
    }
  }
  
  console.log('Brace count:', braceCount);
  console.log('Paren count:', parenCount);
  
  // Find line 167
  const lines = content.split('\n');
  console.log('Line 167:', lines[166]);
  console.log('Line 166:', lines[165]);
  console.log('Line 168:', lines[167]);
  
} catch (e) {
  console.error('Error:', e.message);
}