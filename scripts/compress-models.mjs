// Compress every GLB under static/models in place: dedup, drop unused vertex
// attributes (the kit ships TANGENT with no normal maps), weld, quantize
// (KHR_mesh_quantization) and meshopt (EXT_meshopt_compression).
//
// The Kenney kit embeds the same 10 KB `colormap` PNG in every file. Textures
// named `colormap` are written once to <folder>/colormap.png and replaced in
// each GLB by a 1x1 placeholder; Resources.js swaps the shared image back in
// at load (per-texture KHR_texture_transform is kept).
//
// Idempotent: compression is skipped for files already carrying
// EXT_meshopt_compression, and the colormap step for placeholders.
// Node hierarchy and names are preserved (hero rig empties, kit part names).
//
//   npm run assets:models

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const ROOT = fileURLToPath(new URL('../static/models/', import.meta.url));
const SHARED_NAME = 'colormap';
// 1x1 opaque white PNG (67 bytes)
const PLACEHOLDER = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (extname(name).toLowerCase() === '.glb') out.push(p);
    }
    return out;
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const files = walk(ROOT);
let before = 0, after = 0, skipped = 0, shared = 0;

for (const file of files) {
    const size = statSync(file).size;
    const doc = await io.read(file);
    const root = doc.getRoot();
    let dirty = false;

    const required = root.listExtensionsRequired().map((e) => e.extensionName);
    if (!required.includes('EXT_meshopt_compression')) {
        await doc.transform(
            dedup(),
            // keepLeaves: empty nodes are rig points, keep them
            prune({ keepAttributes: false, keepLeaves: true }),
            weld(),
            reorder({ encoder: MeshoptEncoder }),
            quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
            meshopt({ encoder: MeshoptEncoder, level: 'high' })
        );
        dirty = true;
    }

    // Share the kit colormap: write once per folder, embed a placeholder
    for (const tex of root.listTextures()) {
        const img = tex.getImage();
        if (tex.getName() !== SHARED_NAME || !img || img.byteLength <= PLACEHOLDER.byteLength) continue;
        const target = join(dirname(file), `${SHARED_NAME}.png`);
        if (!existsSync(target)) writeFileSync(target, img);
        tex.setImage(new Uint8Array(PLACEHOLDER)).setMimeType('image/png');
        dirty = true; shared++;
    }

    if (!dirty) { skipped++; before += size; after += size; continue; }
    await io.write(file, doc);
    const now = statSync(file).size;
    before += size; after += now;
    console.log(`${file.slice(ROOT.length).padEnd(44)} ${(size / 1024).toFixed(0).padStart(5)} KB -> ${(now / 1024).toFixed(0).padStart(4)} KB`);
}

console.log(`\n${files.length} files (${skipped} untouched, ${shared} colormaps shared): ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
