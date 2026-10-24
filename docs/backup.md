# Backup and Restore Guide

## Overview

Math Tutor stores all user data locally. This guide covers backup and restore procedures for:
- Question bank (SQLite database)
- User attempts and progress
- Whiteboard state (localStorage)
- Bookmarks and preferences

## Data Locations

### Development

| Data | Location |
|------|----------|
| SQLite Database | `math_tutor.db` (project root) |
| Whiteboard State | Browser localStorage (`math_tutor_whiteboard_state_v1`) |
| AI Cache | `cache/ai_responses/` |

### Production (Tauri)

| Data | Location |
|------|----------|
| SQLite Database | `%APPDATA%\math-tutor\math_tutor.db` |
| Whiteboard State | WebView localStorage |
| AI Cache | `%APPDATA%\math-tutor\cache\ai_responses\` |

## Backup Procedures

### Automated Backup (Recommended)

Create a PowerShell script `backup.ps1`:

```powershell
# backup.ps1 - Run daily via Task Scheduler
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "$env:USERPROFILE\math-tutor-backups"
$appData = "$env:APPDATA\math-tutor"

New-Item -ItemType Directory -Force -Path $backupDir

# Backup database
Copy-Item "$appData\math_tutor.db" "$backupDir\math_tutor_$timestamp.db"

# Backup AI cache (optional)
if (Test-Path "$appData\cache") {
    Copy-Item "$appData\cache" "$backupDir\cache_$timestamp" -Recurse
}

# Keep only last 30 days
$cutoff = (Get-Date).AddDays(-30)
Get-ChildItem "$backupDir\math_tutor_*.db" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item
Get-ChildItem "$backupDir\cache_*" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Recurse

Write-Host "Backup completed: $backupDir\math_tutor_$timestamp.db"
```

Schedule with Task Scheduler:
```powershell
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument '-File "C:\path\to\backup.ps1"'
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "MathTutorBackup" -Description "Daily Math Tutor backup"
```

### Manual Backup

```powershell
# Quick manual backup
$date = Get-Date -Format "yyyyMMdd"
Copy-Item "$env:APPDATA\math-tutor\math_tutor.db" "$env:USERPROFILE\math_tutor_backup_$date.db"
```

### Export Questions to JSON

```bash
# Via API (backend must be running)
curl http://127.0.0.1:8000/questions > questions_export_$(date +%Y%m%d).json
```

Or use the CLI:
```python
# export_questions.py
import aiosqlite, json, asyncio

async def export():
    async with aiosqlite.connect("math_tutor.db") as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM questions") as cursor:
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
    
    with open(f"questions_export_{datetime.now().strftime('%Y%m%d')}.json", "w") as f:
        json.dump(questions, f, indent=2)

asyncio.run(export())
```

## Restore Procedures

### Restore Database

```powershell
# Stop the app first!
# Then:
Copy-Item "$env:USERPROFILE\math_tutor_backup_20240115.db" "$env:APPDATA\math-tutor\math_tutor.db"
```

### Restore from JSON Export

```bash
# Via API
curl -X POST http://127.0.0.1:8000/questions/import \
  -H "Content-Type: application/json" \
  -d @questions_export_20240115.json
```

Or use the CLI importer:
```python
# import_questions.py
import json, asyncio
from backend.database import init_db, get_db
from backend.schemas import QuestionSchema

async def import_questions(json_path):
    await init_db()
    with open(json_path) as f:
        questions = json.load(f)
    
    async for db in get_db():
        for q_data in questions:
            try:
                QuestionSchema.validate_raw_json(q_data)
                q = QuestionSchema(**q_data)
                await db.execute(
                    """INSERT OR REPLACE INTO questions (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (q.id, q.schema_version, q.course, q.topic, q.difficulty, q.question_type,
                     q.question_text, q.question_latex, json.dumps(q.source.dict()),
                     json.dumps(q.hints), q.answer_latex, json.dumps(q.solution_steps),
                     q.verification_status, json.dumps(q.misconceptions), json.dumps(q.tags))
                )
            except Exception as e:
                print(f"Error importing {q_data.get('id')}: {e}")
        await db.commit()

asyncio.run(import_questions("questions_export_20240115.json"))
```

### Restore Whiteboard State

The whiteboard state is stored in browser localStorage. To backup/restore:

```javascript
// In browser console (dev tools)
// Backup
const backup = localStorage.getItem('math_tutor_whiteboard_state_v1');
console.log(backup); // Copy this string

// Restore
localStorage.setItem('math_tutor_whiteboard_state_v1', 'PASTED_BACKUP_STRING');
location.reload();
```

## Migration Between Versions

When schema changes (schema_version increment):

1. Backup current database
2. Run migration script
3. Verify data integrity
4. Update `question.schema.json`

Example migration (v1.0 → v1.1 adding `estimated_time` field):

```sql
-- migration_v1_1.sql
ALTER TABLE questions ADD COLUMN estimated_time INTEGER DEFAULT 10;
UPDATE questions SET schema_version = '1.1';
```

Run via:
```python
async def migrate():
    async with aiosqlite.connect("math_tutor.db") as db:
        await db.executescript(open("migration_v1_1.sql").read())
        await db.commit()
```

## Verification

After restore, verify:

```bash
# Check question count
curl http://127.0.0.1:8000/questions | jq length

# Check attempts
curl http://127.0.0.1:8000/attempts/q_calc_001

# Verify schema
python -c "
import jsonschema, json
with open('question.schema.json') as f: schema = json.load(f)
with open('questions_export.json') as f: data = json.load(f)
for q in data: jsonschema.validate(q, schema)
print('All valid')
"
```

## Disaster Recovery Checklist

- [ ] Database file exists and is readable
- [ ] Schema version matches expected
- [ ] Question count matches expectation
- [ ] Attempts linked to valid questions
- [ ] Bookmarks reference existing questions
- [ ] Whiteboard state loads without error
- [ ] AI cache functional (optional)

## Best Practices

1. **Backup daily** - Automate with Task Scheduler
2. **Test restores monthly** - Verify backup integrity
3. **Keep 30 days** - Rolling window of daily backups
4. **Export JSON monthly** - Human-readable archive
5. **Document schema changes** - Migration scripts in version control
6. **Off-site copy** - Copy backups to cloud/USB monthly