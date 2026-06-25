# FreshGuard Marketing Video

Automated 2-minute product walkthrough with voiceover.

## Output

After running, open:

```
output/FreshGuard-Marketing-Walkthrough.mp4
```

## Prerequisites

1. FreshGuard running locally:
   ```bash
   cd backend && npm start    # port 4000
   cd main && npm run dev     # port 3000
   ```

2. macOS (for `say` voiceover) — or edit `generate-voiceover.mjs` for another TTS engine.

## How sync works

Each voiceover **paragraph = one scene**:

1. `npm run voice` — generates 6 MP3 clips and measures exact duration per scene
2. `npm run record` — records 6 separate UI clips, **holding each until the voice clip length matches**
3. `npm run build` — trims/pads video to audio per scene, then concatenates

This keeps narration aligned with what's on screen (intro → dashboard → vendor → logistics/QC → store/claims → reports).

```bash
cd marketing-video
npm install
npx playwright install chromium
npm run all
```

Or step by step:

| Command | Action |
|---------|--------|
| `npm run record` | Playwright UI walkthrough (1920×1080) |
| `npm run voice` | Voiceover from `voiceover.txt` |
| `npm run build` | Title card + color grade + audio sync |

## Customize

- **Script:** edit `voiceover.txt`
- **Scenes / timing:** edit `record-walkthrough.mjs`
- **Voice:** set `voice` and `rate` in `generate-voiceover.mjs` (Daniel, Samantha, etc.)

## Re-record tips

- Use light mode for clearest product shots (browser context uses light theme).
- Ensure logistics map loads (OpenStreetMap tiles need network during recording).
- QC scan scene waits ~6s for AI analysis — keep backend + `GEMINI_API_KEY` running for best results.
