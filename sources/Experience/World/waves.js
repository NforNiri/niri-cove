/**
 * Single source of truth for the sea surface.
 *
 * The same Gerstner wave set is evaluated on the GPU (Ocean.js vertex shader)
 * and on the CPU (buoyancy for the boat and floaters). If you change a wave
 * here, both stay in sync automatically.
 *
 * Each wave: direction (xz), steepness (0..1, share of the self-intersection
 * limit), wavelength (world units). Amplitude = steepness / k.
 */
export const WAVES = [
    { dir: [1.0, 0.35], steepness: 0.14, wavelength: 19.0 },   // long, slow swell
    { dir: [-0.55, 1.0], steepness: 0.11, wavelength: 11.0 },  // cross swell
    { dir: [0.4, -1.0], steepness: 0.09, wavelength: 6.0 },    // chop
    { dir: [-1.0, -0.45], steepness: 0.06, wavelength: 3.2 },  // ripple
];

export const GRAVITY = 9.81;
// Calm Caribbean: waves travel at 65% of their deep-water speed
export const TIME_SCALE = 0.65;

const TWO_PI = Math.PI * 2;

// Pre-normalise directions and derive per-wave constants once
const PRE = WAVES.map((w) => {
    const len = Math.hypot(w.dir[0], w.dir[1]);
    const k = TWO_PI / w.wavelength;
    return {
        dx: w.dir[0] / len,
        dz: w.dir[1] / len,
        k,
        c: Math.sqrt(GRAVITY / k),
        a: w.steepness / k,
    };
});

/**
 * Flattened uniform-friendly arrays for the shader.
 * waveA: dir.x, dir.z, steepness, wavelength
 */
export function wavesToUniform(count = WAVES.length) {
    return WAVES.slice(0, count).map((w) => {
        const len = Math.hypot(w.dir[0], w.dir[1]);
        return [w.dir[0] / len, w.dir[1] / len, w.steepness, w.wavelength];
    });
}

/**
 * Gerstner displacement for a rest-position (x, z) at time t (seconds).
 * Returns { dx, dy, dz }.
 */
export function displacement(x, z, t, count = PRE.length) {
    let dx = 0, dy = 0, dz = 0;
    const time = t * TIME_SCALE;
    for (let i = 0; i < count; i++) {
        const w = PRE[i];
        const f = w.k * (w.dx * x + w.dz * z - w.c * time);
        const cosF = Math.cos(f);
        dx += w.dx * w.a * cosF;
        dz += w.dz * w.a * cosF;
        dy += w.a * Math.sin(f);
    }
    return { dx, dy, dz };
}

/**
 * Height of the visible surface at world (x, z).
 * Gerstner waves shift vertices sideways, so we invert the horizontal map with a
 * few fixed-point iterations before reading the height.
 */
export function sampleHeight(x, z, t, count = PRE.length) {
    let px = x, pz = z;
    for (let i = 0; i < 3; i++) {
        const d = displacement(px, pz, t, count);
        px = x - d.dx;
        pz = z - d.dz;
    }
    return displacement(px, pz, t, count).dy;
}

/**
 * Approximate surface normal at (x, z) via central differences.
 */
export function sampleNormal(x, z, t, out, count = PRE.length) {
    const e = 0.35;
    const hL = sampleHeight(x - e, z, t, count);
    const hR = sampleHeight(x + e, z, t, count);
    const hD = sampleHeight(x, z - e, t, count);
    const hU = sampleHeight(x, z + e, t, count);
    out.x = hL - hR;
    out.y = 2 * e;
    out.z = hD - hU;
    return out.normalize();
}

// GLSL implementation. Shared string so Ocean (and any other water material)
// use exactly the same function as the CPU.
export const WAVES_GLSL = /* glsl */ `
    #define MAX_WAVES 4
    uniform vec4 uWaves[MAX_WAVES];
    uniform int uWaveCount;
    uniform float uTime;

    const float G = ${GRAVITY.toFixed(3)};

    vec3 gerstnerDisplacement(vec2 p) {
        vec3 d = vec3(0.0);
        for (int i = 0; i < MAX_WAVES; i++) {
            if (i >= uWaveCount) break;
            vec4 w = uWaves[i];
            vec2 dir = w.xy;
            float k = 6.28318530718 / w.w;
            float c = sqrt(G / k);
            float a = w.z / k;
            float f = k * (dot(dir, p) - c * uTime);
            d.x += dir.x * a * cos(f);
            d.z += dir.y * a * cos(f);
            d.y += a * sin(f);
        }
        return d;
    }
`;
