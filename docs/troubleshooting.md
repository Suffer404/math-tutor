# Troubleshooting Guide

## Common Issues

### Frontend Issues

#### "Failed to load whiteboard state" in tests
**Cause**: `localStorage` not available in jsdom test environment
**Solution**: Tests mock this, but warnings appear in stderr. Tests still pass.

#### Whiteboard not loading / blank canvas
**Cause**: Excalidraw CSS not loaded or container has zero height
**Solution**: Ensure parent has explicit height.

#### KaTeX rendering errors
**Cause**: Invalid LaTeX syntax in question data
**Solution**: Validate LaTeX before saving. Use `throwOnError: false`.

#### "Module not found" for @excalidraw/excalidraw
**Cause**: Package not installed or version mismatch
**Solution**: `npm.cmd install @excalidraw/excalidraw@0.17.6`

### Backend Issues

#### "ModuleNotFoundError: No module named 'backend'"
**Cause**: Running pytest from wrong directory
**Solution**: Run from project root: `python -m pytest backend/test_backend.py -v`

#### Database locked / "database is locked"
**Cause**: Multiple processes accessing SQLite simultaneously
**Solution**: Use `aiosqlite` with proper connection handling, ensure single backend instance.

#### "PydanticDeprecatedSince20: The `dict` method is deprecated"
**Cause**: Using `.dict()` instead of `.model_dump()` in Pydantic v2
**Solution**: Replace `.dict()` with `.model_dump()`.

#### SymPy parsing fails on valid input
**Cause**: Using `^` instead of `**` for exponentiation
**Solution**: Pre-process input to replace `^` with `**`.

#### AI Provider returns "Rate limit exceeded"
**Cause**: Too many requests to free-tier API
**Solution**: Implement exponential backoff, use caching, switch to mock provider.

#### "CORS error" when calling API from frontend
**Cause**: Backend CORS not configured for frontend origin
**Solution**: Update CORS in `backend/main.py` to allow frontend origins.

### Installation Issues

#### npm install fails with "EACCES" or permission errors
**Cause**: npm cache permissions
**Solution**: `npm.cmd cache clean --force && npm.cmd install`

#### Python packages fail to install (sympy, numpy, etc.)
**Cause**: Missing Visual C++ build tools on Windows
**Solution**: Install Microsoft Visual C++ Build Tools or use `--only-binary :all:`

#### Rust/Cargo not found for Tauri
**Cause**: Rust not installed
**Solution**: `winget install Rustlang.Rust` or `choco install rust`

### Runtime Issues

#### Backend won't start: "Address already in use"
**Cause**: Port 8000 already in use
**Solution**: Find and kill process or use different port.

#### Frontend can't connect to backend
**Cause**: Backend not running or wrong URL
**Solution**: Verify backend running, check frontend API base URL, check firewall.

#### Whiteboard state not persisting
**Cause**: localStorage disabled or private browsing
**Solution**: Ensure not in private/incognito mode, check browser settings.

#### Handwriting analysis always returns error
**Cause**: Canvas capture failing or AI provider misconfigured
**Solution**: Check browser console, verify AI_PROVIDER, ensure mock provider works.

### Data Issues

#### Questions not appearing after import
**Cause**: Validation failed silently
**Solution**: Check import response with curl.

#### Attempts not saving
**Cause**: Foreign key constraint (question_id doesn't exist)
**Solution**: Ensure question exists before recording attempt.

#### Schema validation errors
**Cause**: Missing required fields in question JSON
**Solution**: Validate against `question.schema.json`.

## Debugging Tips

### Enable Debug Logging
**Backend**: `logging.basicConfig(level=logging.DEBUG)`
**Frontend**: Add debug flag to vite config.

### Inspect Network Requests
Use DevTools Network tab, filter by "Fetch/XHR".

### Database Inspection
Use `sqlite3 math_tutor.db` with queries like `.tables`, `.schema questions`.

### AI Response Debugging
Check `cache/ai_responses/` directory.

## Performance Issues

### Large Bundle Size (>500KB warning)
**Cause**: Excalidraw + KaTeX fonts bundled
**Solution**: Code-split views with React.lazy and Suspense.

### Slow SymPy Operations
**Solution**: Cache parsed expressions, use simpler checks first.

### Slow AI Responses
**Solution**: Resize canvas before capture, use simpler prompts, enable caching.

## Getting Help
1. Check this guide
2. Check `KNOWN-LIMITATIONS.md`
3. Run tests
4. Create minimal reproduction case

## Log Locations
| Component | Location |
|-----------|----------|
| Backend | Console where uvicorn runs |
| Frontend | Browser DevTools Console |
| Tauri | `%APPDATA%\math-tutor\logs\` |
| Windows Event Viewer | Applications > Math Tutor |