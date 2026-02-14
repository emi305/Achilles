# AI Setup (Local, Windows-friendly)

This project uses `OPENAI_API_KEY` for AI extraction in `/api/extract`.

## 1) Create `.env.local`

Create a file named `.env.local` at the repository root (same folder as `package.json`).

Add:

```env
OPENAI_API_KEY=sk-...
# Optional
OPENAI_MODEL=gpt-4.1-mini
```

## 2) Restart the dev server

Environment variables are loaded on server start.

1. Stop the current server (`Ctrl+C`)
2. Start again:

```powershell
npm run dev
```

## 3) Verify configuration

Open:

`http://localhost:3000/api/health`

Expected when configured:

```json
{
  "ok": true,
  "hasOpenAIKey": true,
  "model": "gpt-4.1-mini",
  "runtime": "nodejs"
}
```

## 4) Test `/api/extract` from PowerShell

```powershell
$body = @{
  exam = "comlex2"
  rawText = "Internal Medicine 50/80`nOBGYN 21/40`nPsychiatry 18/30"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/extract" `
  -ContentType "application/json" `
  -Body $body
```

You can also test in browser flow:

1. Go to `/upload`
2. Leave `Advanced: Parse as CSV` OFF (AI mode)
3. Paste sample text and click Analyze
4. Expected: route to `/results` or `/review` (not config error)
