import pytest
import httpx
import os
import json
import asyncio
from backend.main import app
from backend.database import init_db, DB_PATH
from fastapi.testclient import TestClient

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    # Use a temporary test database
    test_db = "test_math_tutor.db"
    if os.path.exists(test_db):
        os.remove(test_db)
    
    # Override DB_PATH in database.py or set env
    import backend.database
    backend.database.DB_PATH = test_db
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(init_db(test_db))
    yield
    if os.path.exists(test_db):
        os.remove(test_db)

def test_import_and_list():
    with open("sample_bank.json", "r") as f:
        sample_questions = json.load(f)
    
    # Good import
    response = client.post("/questions/import", json=sample_questions)
    assert response.status_code == 200
    assert response.json()["imported"] == 2
    
    # List all
    response = client.get("/questions")
    assert len(response.json()) == 2
    
    # Filter
    response = client.get("/questions?topic=Derivatives")
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == "q_calc_001"

def test_malformed_import():
    bad_questions = [
        {"id": "bad_1", "schema_version": "1.0"} # Missing required fields
    ]
    response = client.post("/questions/import", json=bad_questions)
    assert response.status_code == 200
    assert response.json()["imported"] == 0
    assert len(response.json()["errors"]) == 1

def test_attempts():
    # Import first
    with open("sample_bank.json", "r") as f:
        client.post("/questions/import", json=json.load(f))
        
    attempt_data = {
        "question_id": "q_calc_001",
        "user_solution": "3x^2 - 4",
        "is_correct": True,
        "feedback": {"score": 1.0}
    }
    response = client.post("/attempts", json=attempt_data)
    assert response.status_code == 200
    attempt_id = response.json()["id"]
    
    response = client.get("/attempts/q_calc_001")
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == attempt_id

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"
    assert "ai_configured" in data
    assert "provider" in data
    assert "model" in data
    assert isinstance(data["ai_configured"], bool)
    assert isinstance(data["provider"], str)
    assert isinstance(data["model"], str)
