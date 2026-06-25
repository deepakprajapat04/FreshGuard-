#!/usr/bin/env node
/**
 * Generates one voiceover MP3 per scene; writes output/scene-timing.json
 */
import { execSync, spawnSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCENES } from './scenes.mjs';
import { FFMPEG, probeDuration } from './ffmpeg-utils.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'output');
const CLIPS_DIR = path.join(OUT_DIR, 'audio-clips');
const VOICE = process.env.VOICE || 'Daniel';
const RATE = Number(process.env.VOICE_RATE || 158);

mkdirSync(CLIPS_DIR, { recursive: true });

const timing = [];

console.log(`Generating ${SCENES.length} synced voiceover clips…\n`);

for (const scene of SCENES) {
  const txtPath = path.join(CLIPS_DIR, `${scene.id}.txt`);
  const aiffPath = path.join(CLIPS_DIR, `${scene.id}.aiff`);
  const mp3Path = path.join(CLIPS_DIR, `${scene.id}.mp3`);

  writeFileSync(txtPath, scene.voice.trim());

  if (process.platform === 'darwin') {
    execSync(`say -v ${VOICE} -r ${RATE} -o "${aiffPath}" -f "${txtPath}"`, { stdio: 'pipe' });
  } else {
    spawnSync('espeak', ['-f', txtPath, '-w', aiffPath], { stdio: 'inherit' });
  }

  execSync(
    `"${FFMPEG}" -y -i "${aiffPath}" -acodec libmp3lame -ab 192k -ar 44100 "${mp3Path}"`,
    { stdio: 'pipe' }
  );

  const duration = probeDuration(mp3Path);
  timing.push({ id: scene.id, audio: mp3Path, durationSec: duration });
  console.log(`  ${scene.id}: ${duration.toFixed(2)}s`);
}

const totalSec = timing.reduce((s, t) => s + t.durationSec, 0);
writeFileSync(path.join(OUT_DIR, 'scene-timing.json'), JSON.stringify({ scenes: timing, totalSec }, null, 2));

console.log(`\n✓ Total voiceover: ${totalSec.toFixed(1)}s`);
console.log(`✓ Timing manifest: output/scene-timing.json`);
