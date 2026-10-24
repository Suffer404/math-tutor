import aiosqlite
import json
import os
from pathlib import Path

DB_PATH = Path(os.getenv("MATH_TUTOR_DB_PATH", "math_tutor.db"))

INIT_SQL = """
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    schema_version TEXT NOT NULL,
    course TEXT NOT NULL,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question_type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_latex TEXT,
    source_json TEXT NOT NULL,
    hints_json TEXT NOT NULL,
    answer_latex TEXT NOT NULL,
    solution_steps_json TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    misconceptions_json TEXT,
    tags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    user_solution TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    feedback_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions (id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
    question_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions (id)
);
"""

async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db

async def init_db(db_path=DB_PATH):
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(INIT_SQL)
        await db.commit()
