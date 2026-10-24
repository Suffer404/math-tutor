from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import json
import uuid
import os
from .database import get_db, init_db
from .schemas import QuestionSchema, AttemptCreate
import aiosqlite
from .sympy_service import (
    parse_latex_safe, parse_sympy_safe, differentiate, integrate_expr,
    simplify_expr, check_equivalence, solve_equation, compute_limit,
    verify_step, SymPyVerificationError
)
from .ai_provider import get_provider, SyncAIProvider, AIResponse
from sympy import symbols
import sympy as sp
from pydantic import BaseModel
from typing import Union, Optional

app = FastAPI(title="Math Tutor Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to tauri app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.post("/questions/import")
async def import_questions(questions: List[dict], db: aiosqlite.Connection = Depends(get_db)):
    imported_count = 0
    errors = []
    
    for q_data in questions:
        try:
            # Validate against JSON schema
            QuestionSchema.validate_raw_json(q_data)
            q = QuestionSchema(**q_data)
            
            await db.execute(
                """
                INSERT OR REPLACE INTO questions (
                    id, schema_version, course, topic, difficulty, question_type, 
                    question_text, question_latex, source_json, hints_json, 
                    answer_latex, solution_steps_json, verification_status, 
                    misconceptions_json, tags_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    q.id, q.schema_version, q.course, q.topic, q.difficulty, q.question_type,
                    q.question_text, q.question_latex, json.dumps(q.source.dict()),
                    json.dumps(q.hints), q.answer_latex, json.dumps(q.solution_steps),
                    q.verification_status, json.dumps(q.misconceptions), json.dumps(q.tags)
                )
            )
            imported_count += 1
        except Exception as e:
            errors.append({"id": q_data.get("id", "unknown"), "error": str(e)})
    
    await db.commit()
    return {"imported": imported_count, "errors": errors}

@app.get("/questions")
async def list_questions(
    topic: Optional[str] = None, 
    difficulty: Optional[str] = None,
    db: aiosqlite.Connection = Depends(get_db)
):
    query = "SELECT * FROM questions WHERE 1=1"
    params = []
    if topic:
        query += " AND topic = ?"
        params.append(topic)
    if difficulty:
        query += " AND difficulty = ?"
        params.append(difficulty)
        
    async with db.execute(query, params) as cursor:
        rows = await cursor.fetchall()
        
    questions = []
    for row in rows:
        q = dict(row)
        q["source"] = json.loads(q.pop("source_json"))
        q["hints"] = json.loads(q.pop("hints_json"))
        q["solution_steps"] = json.loads(q.pop("solution_steps_json"))
        q["misconceptions"] = json.loads(q.pop("misconceptions_json")) if q.get("misconceptions_json") else None
        q["tags"] = json.loads(q.pop("tags_json")) if q.get("tags_json") else None
        questions.append(q)
    return questions

@app.get("/health")
async def health_check():
    from .ai_provider import get_provider
    provider = get_provider()
    provider_type = os.getenv("AI_PROVIDER", "mock").lower()
    model = "mock"
    if provider_type == "openai":
        model = "gpt-4o-mini"
    elif provider_type == "anthropic":
        model = "claude-3-haiku-20240307"
    return {
        "status": "ok",
        "ai_configured": provider_type != "mock" and bool(os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")),
        "provider": provider_type,
        "model": model,
    }

@app.post("/attempts")
async def create_attempt(attempt: AttemptCreate, db: aiosqlite.Connection = Depends(get_db)):
    attempt_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO attempts (id, question_id, user_solution, is_correct, feedback_json) VALUES (?, ?, ?, ?, ?)",
        (attempt_id, attempt.question_id, attempt.user_solution, 1 if attempt.is_correct else 0, json.dumps(attempt.feedback))
    )
    await db.commit()
    return {"id": attempt_id}

@app.get("/attempts/{question_id}")
async def get_attempts(question_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM attempts WHERE question_id = ? ORDER BY created_at DESC", (question_id,)) as cursor:
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/bookmarks/{question_id}")
async def toggle_bookmark(question_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT 1 FROM bookmarks WHERE question_id = ?", (question_id,)) as cursor:
        if await cursor.fetchone():
            await db.execute("DELETE FROM bookmarks WHERE question_id = ?", (question_id,))
            status = "removed"
        else:
            await db.execute("INSERT INTO bookmarks (question_id) VALUES (?)", (question_id,))
            status = "added"
    await db.commit()
    return {"status": status}

class VerifyRequest(BaseModel):
    user_step: str
    expected_step: str
    var_name: str = "x"

class VerifyResponse(BaseModel):
    equivalent: bool
    method: Optional[str] = None
    confidence: float
    difference: Optional[str] = None
    error: Optional[str] = None
    unsupported: bool = False

@app.post("/verify/step", response_model=VerifyResponse)
async def verify_step_endpoint(req: VerifyRequest):
    result = verify_step(req.user_step, req.expected_step, req.var_name)
    return VerifyResponse(**result)

@app.post("/verify/differentiate")
async def differentiate_endpoint(expr: str, var: str = "x", order: int = 1):
    try:
        x = symbols(var)
        parsed = parse_sympy_safe(expr)
        result = differentiate(parsed, x, order)
        return {"result": str(result), "latex": sp.latex(result)}
    except SymPyVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/verify/integrate")
async def integrate_endpoint(expr: str, var: str = "x", lower: Optional[float] = None, upper: Optional[float] = None):
    try:
        x = symbols(var)
        parsed = parse_sympy_safe(expr)
        limits = (lower, upper) if lower is not None and upper is not None else None
        result = integrate_expr(parsed, x, limits)
        return {"result": str(result), "latex": sp.latex(result)}
    except SymPyVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/verify/simplify")
async def simplify_endpoint(expr: str):
    try:
        parsed = parse_sympy_safe(expr)
        result = simplify_expr(parsed)
        return {"result": str(result), "latex": sp.latex(result)}
    except SymPyVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/verify/equivalence")
async def equivalence_endpoint(expr1: str, expr2: str, var: Optional[str] = None):
    try:
        parsed1 = parse_sympy_safe(expr1)
        parsed2 = parse_sympy_safe(expr2)
        var_sym = symbols(var) if var else None
        result = check_equivalence(parsed1, parsed2, var_sym)
        return result
    except SymPyVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/verify/solve")
async def solve_endpoint(expr: str, var: str = "x"):
    try:
        x = symbols(var)
        parsed = parse_sympy_safe(expr)
        solutions = solve_equation(parsed, x)
        return {"solutions": [str(s) for s in solutions], "latex": [sp.latex(s) for s in solutions]}
    except SymPyVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/verify/limit")
async def limit_endpoint(expr: str, var: str = "x", point: Union[str, float] = 0, dir: str = "+"):
    try:
        x = symbols(var)
        parsed = parse_sympy_safe(expr)
        point_val = parse_sympy_safe(str(point)) if isinstance(point, str) else point
        result = compute_limit(parsed, x, point_val, dir)
        return {"result": str(result), "latex": sp.latex(result)}
    except SymPyVerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))

# AI Provider endpoints
class AIGenerateRequest(BaseModel):
    prompt: str
    system_prompt: Optional[str] = None

class AIGenerateResponse(BaseModel):
    content: str
    model: str
    tokens_used: int
    cached: bool = False
    error: Optional[str] = None

@app.post("/ai/generate", response_model=AIGenerateResponse)
async def ai_generate(req: AIGenerateRequest):
    provider = get_provider()
    sync_provider = SyncAIProvider(provider)
    response = sync_provider.generate_text(req.prompt, req.system_prompt)
    return AIGenerateResponse(**response.__dict__)

class HandwritingCheckRequest(BaseModel):
    image_base64: str
    question_id: Optional[str] = None

class HandwritingCheckResponse(BaseModel):
    recognized_steps: List[dict]
    uncertain_regions: List[dict]
    first_error_step: Optional[int]
    error_explanation: Optional[str]
    hint: str
    confidence: float
    needs_user_confirmation: bool

@app.post("/ai/handwriting-check", response_model=HandwritingCheckResponse)
async def ai_handwriting_check(req: HandwritingCheckRequest):
    provider = get_provider()
    sync_provider = SyncAIProvider(provider)
    
    prompt = """Analyze the handwritten mathematical solution in the image. 
Return a JSON object with:
- recognized_steps: array of {step: int, latex: str, confidence: float}
- uncertain_regions: array of descriptions
- first_error_step: int or null
- error_explanation: str or null
- hint: str (progressive: concept -> rule -> next operation)
- confidence: float (0-1)
- needs_user_confirmation: bool

Focus on calculus/engineering math. Be honest about uncertainty."""
    
    response = sync_provider.generate_vision(prompt, req.image_base64)
    
    if response.error:
        # Return structured error response
        return HandwritingCheckResponse(
            recognized_steps=[],
            uncertain_regions=[{"error": response.error}],
            first_error_step=None,
            error_explanation=f"AI analysis failed: {response.error}",
            hint="Unable to analyze handwriting. Please try again or type your steps.",
            confidence=0.0,
            needs_user_confirmation=True
        )
    
    try:
        parsed = json.loads(response.content)
        return HandwritingCheckResponse(**parsed)
    except json.JSONDecodeError:
        return HandwritingCheckResponse(
            recognized_steps=[],
            uncertain_regions=[{"error": "Failed to parse AI response"}],
            first_error_step=None,
            error_explanation="AI returned invalid format",
            hint="Could not analyze handwriting. Please type your steps for verification.",
            confidence=0.0,
            needs_user_confirmation=True
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
