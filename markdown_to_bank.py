#!/usr/bin/env python3
"""
Markdown to Question Bank CLI

Converts Markdown files with embedded question definitions into the 
standardized question schema JSON format. Uses grounding from source 
document references.
"""

import json
import re
import sys
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
import jsonschema

with open("question.schema.json", "r") as f:
    QUESTION_SCHEMA = json.load(f)

class MarkdownToBank:
    def __init__(self, markdown_path: str):
        self.markdown_path = Path(markdown_path)
        self.content = self.markdown_path.read_text(encoding='utf-8')
        
    def parse(self) -> List[Dict[str, Any]]:
        """Parse markdown and extract questions."""
        questions = []
        
        # Pattern to find question blocks
        # Expected format:
        # ## Question: <title>
        # **Course:** <course>
        # **Topic:** <topic>
        # **Difficulty:** <easy|medium|hard>
        # **Type:** <type>
        # **Source:** <filename> [page N] [section S]
        # 
        # ### Question Text
        # <text>
        # 
        # ### Question LaTeX (optional)
        # $$...$$
        # 
        # ### Hints
        # 1. Hint 1
        # 2. Hint 2
        # 
        # ### Answer
        # $$...$$
        # 
        # ### Solution Steps
        # 1. Step 1
        # 2. Step 2
        
        # Split by question headers
        blocks = re.split(r'\n## Question:\s*', self.content)
        
        for block in blocks[1:]:  # Skip first split (before first header)
            question = self._parse_question_block(block)
            if question:
                questions.append(question)
                
        return questions
    
    def _parse_question_block(self, block: str) -> Optional[Dict[str, Any]]:
        """Parse a single question block."""
        try:
            # Extract metadata
            lines = block.split('\n')
            
            # First line is the title/id
            title = lines[0].strip()
            
            # Parse metadata fields
            metadata = {}
            for line in lines[1:]:
                if line.startswith('**Course:**'):
                    metadata['course'] = line.replace('**Course:**', '').strip()
                elif line.startswith('**Topic:**'):
                    metadata['topic'] = line.replace('**Topic:**', '').strip()
                elif line.startswith('**Difficulty:**'):
                    metadata['difficulty'] = line.replace('**Difficulty:**', '').strip()
                elif line.startswith('**Type:**'):
                    metadata['question_type'] = line.replace('**Type:**', '').strip()
                elif line.startswith('**Source:**'):
                    source_text = line.replace('**Source:**', '').strip()
                    metadata['source'] = self._parse_source(source_text)
                elif line.startswith('###'):
                    break  # End of metadata
                    
            # Parse sections
            question_text = self._extract_section(block, 'Question Text')
            question_latex = self._extract_section(block, 'Question LaTeX')
            hints = self._extract_hints(block)
            answer_latex = self._extract_section(block, 'Answer')
            solution_steps = self._extract_solution_steps(block)
            
            # Build question object
            q = {
                "schema_version": "1.0",
                "id": f"q_{metadata.get('topic', 'gen').lower().replace(' ', '_')}_{uuid.uuid4().hex[:6]}",
                "course": metadata.get('course', 'Unknown Course'),
                "topic": metadata.get('topic', 'Unknown Topic'),
                "difficulty": metadata.get('difficulty', 'medium'),
                "question_type": metadata.get('question_type', 'problem'),
                "question_text": question_text or f"Question: {title}",
                "question_latex": question_latex,
                "source": metadata.get('source', {"filename": self.markdown_path.name}),
                "hints": hints,
                "answer_latex": answer_latex or "",
                "solution_steps": solution_steps,
                "verification_status": "pending",
                "tags": [metadata.get('topic', '').lower().replace(' ', '-')]
            }
            
            return q
        except Exception as e:
            print(f"Warning: Failed to parse question block: {e}", file=sys.stderr)
            return None
    
    def _parse_source(self, source_text: str) -> Dict[str, Any]:
        """Parse source string: 'filename.pdf [page N] [section S]'"""
        result = {"filename": source_text}
        page_match = re.search(r'page\s+(\d+)', source_text, re.IGNORECASE)
        if page_match:
            result["page"] = int(page_match.group(1))
        section_match = re.search(r'section\s+([^\s]+)', source_text, re.IGNORECASE)
        if section_match:
            result["section"] = section_match.group(1)
        return result
    
    def _extract_section(self, block: str, section_name: str) -> Optional[str]:
        """Extract content from a ### Section."""
        pattern = rf'###\s*{re.escape(section_name)}\s*\n(.*?)(?=\n###|\Z)'
        match = re.search(pattern, block, re.DOTALL)
        if match:
            content = match.group(1).strip()
            # Clean up LaTeX delimiters
            content = re.sub(r'^\$\$(.*?)\$\$$', r'\1', content, flags=re.DOTALL)
            content = re.sub(r'^\$(.*?)\$$', r'\1', content, flags=re.DOTALL)
            return content.strip()
        return None
    
    def _extract_hints(self, block: str) -> List[str]:
        """Extract hints from ### Hints section."""
        hints = []
        content = self._extract_section(block, 'Hints')
        if content:
            # Parse numbered hints
            for line in content.split('\n'):
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-') or line.startswith('*')):
                    # Remove numbering
                    hint = re.sub(r'^[\d\-\*\.\)\s]+', '', line).strip()
                    if hint:
                        hints.append(hint)
        return hints
    
    def _extract_solution_steps(self, block: str) -> List[str]:
        """Extract solution steps from ### Solution Steps section."""
        steps = []
        content = self._extract_section(block, 'Solution Steps')
        if content:
            for line in content.split('\n'):
                line = line.strip()
                if line and (line[0].isdigit() or line.startswith('-') or line.startswith('*')):
                    step = re.sub(r'^[\d\-\*\.\)\s]+', '', line).strip()
                    if step:
                        steps.append(step)
        return steps

def validate_questions(questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Validate questions against JSON schema."""
    validated = []
    errors = []
    
    for q in questions:
        try:
            jsonschema.validate(instance=q, schema=QUESTION_SCHEMA)
            validated.append(q)
        except jsonschema.ValidationError as e:
            errors.append({"id": q.get('id', 'unknown'), "error": str(e)})
    
    if errors:
        print(f"Validation errors: {json.dumps(errors, indent=2)}", file=sys.stderr)
    
    return validated

def main():
    if len(sys.argv) < 3:
        print("Usage: python markdown_to_bank.py <input.md> <output.json>")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    converter = MarkdownToBank(input_path)
    questions = converter.parse()
    
    print(f"Parsed {len(questions)} questions from {input_path}")
    
    validated = validate_questions(questions)
    print(f"Validated {len(validated)} questions (errors: {len(questions) - len(validated)})")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(validated, f, indent=2, ensure_ascii=False)
    
    print(f"Written to {output_path}")

if __name__ == "__main__":
    main()