// Encode the lossless source WAVs in assets-src/sounds into web formats in
// static/sounds: OGG Vorbis (Chrome, Firefox, Edge, Safari 17+) and MP3
// (fallback for older Safari). Howler picks the first format it can play.
//
// Loops: seamless looping needs the encoder not to add priming/padding that
// Howler cannot trim. Vorbis is gapless; MP3 gets ~50 ms of padding, which is
// fine for the ambient beds and masked by the crossfades.
//
// Requires ffmpeg on PATH. Skips outputs newer than their source.
//
//   npm run assets:sounds

import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SRC = fileURLToPath(new URL('../assets-src/sounds/', import.meta.url));
const OUT = fileURLToPath(new URL('../static/sounds/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.wav'));
let inBytes = 0, outBytes = 0;

function encode(src, dst, args) {
    if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) return statSync(dst).size;
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, ...args, dst], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${dst}`);
    return statSync(dst).size;
}

for (const f of files) {
    const base = f.slice(0, -4);
    const src = join(SRC, f);
    inBytes += statSync(src).size;
    // Music beds keep stereo; everything else is mono to halve the bytes
    const music = /^music-/.test(base);
    const ch = music ? [] : ['-ac', '1'];
    const ogg = encode(src, join(OUT, `${base}.ogg`), ['-c:a', 'libvorbis', '-q:a', music ? '4' : '3', ...ch]);
    const mp3 = encode(src, join(OUT, `${base}.mp3`), ['-c:a', 'libmp3lame', '-q:a', music ? '4' : '5', ...ch]);
    outBytes += ogg + mp3;
    console.log(`${base.padEnd(18)} ${(statSync(src).size / 1024).toFixed(0).padStart(5)} KB -> ogg ${(ogg / 1024).toFixed(0).padStart(4)} KB, mp3 ${(mp3 / 1024).toFixed(0).padStart(4)} KB`);
}

console.log(`\n${files.length} sounds: ${(inBytes / 1024).toFixed(0)} KB wav -> ${(outBytes / 1024).toFixed(0)} KB ogg+mp3 (a browser downloads one of the two)`);
