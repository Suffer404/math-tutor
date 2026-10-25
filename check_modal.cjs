const fs = require('fs');
const content = fs.readFileSync('src/components/AddQuestionModal.tsx', 'utf8');

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

console.log('AddQuestionModal - Brace count:', braceCount);
console.log('Paren count:', parenCount);