#!/usr/bin/env node
/**
 * Merges each scene's video + audio, concatenates, and muxes narration reliably.
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCENES } from './scenes.mjs';
import { FFMPEG, probeDuration } from './ffmpeg-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'output');
const CLIPS_V = path.join(OUT_DIR, 'video-clips');
const CLIPS_A = path.join(OUT_DIR, 'audio-clips');
const SYNCED = path.join(OUT_DIR, 'synced-scenes');
const FINAL = path.join(OUT_DIR, 'FreshGuard-Marketing-Walkthrough.mp4');
const TITLE_SEC = 2;

mkdirSync(SYNCED, { recursive: true });

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

const vfGrade =
  'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,eq=contrast=1.05:brightness=0.02:saturation=1.08,fps=30';

console.log('Step 1: Sync each scene (video length = voiceover length)…\n');

const videoOnlyPaths = [];

for (const scene of SCENES) {
  const videoIn = path.join(CLIPS_V, `${scene.id}.webm`);
  const audioIn = path.join(CLIPS_A, `${scene.id}.mp3`);
  const out = path.join(SYNCED, `${scene.id}-video.mp4`);

  if (!existsSync(videoIn) || !existsSync(audioIn)) {
    console.error(`Missing clip for ${scene.id}. Run: npm run voice && npm run record`);
    process.exit(1);
  }

  const audioDur = probeDuration(audioIn);
  const videoDur = probeDuration(videoIn);
  console.log(`  ${scene.id}: video ${videoDur.toFixed(1)}s → audio ${audioDur.toFixed(1)}s`);

  if (videoDur >= audioDur - 0.05) {
    run(
      `"${FFMPEG}" -y -i "${videoIn}" -vf "${vfGrade}" -t ${audioDur.toFixed(3)} -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p "${out}"`
    );
  } else {
    const padSec = (audioDur - videoDur + 0.15).toFixed(3);
    run(
      `"${FFMPEG}" -y -i "${videoIn}" -vf "${vfGrade},tpad=stop_mode=clone:stop_duration=${padSec}" -t ${audioDur.toFixed(3)} -an -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p "${out}"`
    );
  }

  videoOnlyPaths.push(out);
}

console.log('\nStep 2: Title card + narration track…');

const titleMp4 = path.join(SYNCED, '00-title.mp4');
try {
  run(
    `"${FFMPEG}" -y -f lavfi -i color=c=0x0f172a:s=1920x1080:r=30:d=${TITLE_SEC} -vf "drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial Bold.ttf:text='FreshGuard':fontsize=92:fontcolor=0x10b981:x=(w-text_w)/2:y=(h-text_h)/2-50,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='Cold-Chain Intelligence Platform':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+45" -c:v libx264 -pix_fmt yuv420p -an "${titleMp4}"`
  );
} catch {
  run(
    `"${FFMPEG}" -y -f lavfi -i color=c=0x0f172a:s=1920x1080:r=30:d=${TITLE_SEC} -c:v libx264 -pix_fmt yuv420p -an "${titleMp4}"`
  );
}

// 2s silence + all scene voiceovers in one track
const silenceMp3 = path.join(SYNCED, 'silence-2s.mp3');
run(
  `"${FFMPEG}" -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${TITLE_SEC} -c:a libmp3lame -b:a 192k "${silenceMp3}"`
);

const audioConcatList = path.join(SYNCED, 'audio-concat.txt');
const audioParts = [silenceMp3, ...SCENES.map((s) => path.join(CLIPS_A, `${s.id}.mp3`))];
writeFileSync(audioConcatList, audioParts.map((f) => `file '${f}'`).join('\n'));

const narrationMp3 = path.join(SYNCED, 'full-narration.mp3');
run(`"${FFMPEG}" -y -f concat -safe 0 -i "${audioConcatList}" -c copy "${narrationMp3}"`);

console.log(`  Narration track: ${probeDuration(narrationMp3).toFixed(1)}s`);

console.log('\nStep 3: Concatenate video clips…');

const videoConcatList = path.join(SYNCED, 'video-concat.txt');
writeFileSync(
  videoConcatList,
  [titleMp4, ...videoOnlyPaths].map((f) => `file '${f}'`).join('\n')
);

const combinedVideo = path.join(SYNCED, 'combined-video.mp4');
run(
  `"${FFMPEG}" -y -f concat -safe 0 -i "${videoConcatList}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -an "${combinedVideo}"`
);

console.log('\nStep 4: Mux video + voiceover…');

run(
  `"${FFMPEG}" -y -i "${combinedVideo}" -i "${narrationMp3}" -map 0:v:0 -map 1:a:0 -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest "${FINAL}"`
);

// Verify audio exists
const probeOut = execSync(`"${FFMPEG}" -i "${FINAL}" 2>&1 || true`, { encoding: 'utf8' });
if (!probeOut.includes('Audio:')) {
  console.error('\n❌ ERROR: Final file has no audio track. Check ffmpeg output above.');
  process.exit(1);
}

const totalDur = probeDuration(FINAL);
console.log(`\n✅ Synced video with voiceover: ${FINAL}`);
console.log(`   Duration: ${totalDur.toFixed(1)}s (${Math.floor(totalDur / 60)}m ${Math.round(totalDur % 60)}s)`);
console.log('   Audio: ✓ narration track attached');

try {
  unlinkSync(combinedVideo);
} catch {
  /* ok */
}
