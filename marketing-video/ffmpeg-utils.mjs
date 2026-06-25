import { spawnSync } from 'child_process';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

export const FFMPEG = ffmpegPath.path;

/** Probe media duration — works without standalone ffprobe binary */
export function probeDuration(file) {
  const r = spawnSync(FFMPEG, ['-i', file], { encoding: 'utf8' });
  const match = (r.stderr || '').match(/Duration:\s(\d+):(\d+):([\d.]+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseFloat(match[3]);
}
