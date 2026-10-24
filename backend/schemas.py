from pydantic import BaseModel, Field
from typing import List, Optional
import json
import jsonschema

with open("question.schema.json", "r") as f:
    QUESTION_JSON_SCHEMA = json.load(f)

class SourceSchema(BaseModel):
    filename: str
    page: Optional[int] = None
    section: Optional[str] = None

class QuestionSchema(BaseModel):
    schema_version: str = "1.0"
    id: str
    course: str
    topic: str
    difficulty: str
    question_type: str
    question_text: str
    question_latex: Optional[str] = None
    source: SourceSchema
    hints: List[str]
    answer_latex: str
    solution_steps: List[str]
    verification_status: str
    misconceptions: Optional[List[str]] = None
    tags: Optional[List[str]] = None

    @classmethod
    def validate_raw_json(cls, raw_data: dict):
        jsonschema.validate(instance=raw_data, schema=QUESTION_JSON_SCHEMA)

class AttemptCreate(BaseModel):
    question_id: str
    user_solution: str
    is_correct: bool
    feedback: Optional[dict] = None
