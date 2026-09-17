import * as THREE from 'three';
import Experience from '../Experience.js';
import { WAVES_GLSL, wavesToUniform, sampleHeight, sampleNormal, TIME_SCALE } from './waves.js';
import { shoreDistance, waveDamping } from './layout.js';

const OCEAN_SIZE = 280;

const TIERS = {
    high: { segments: 220, waveCount: 4, detail: true },
    low:  { segments: 110, waveCount: 3, detail: false },
};

export default class Ocean {
    constructor() {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.renderer = this.experience.renderer;

        this.timeSec = 0;
        this.palette = {
            deep: new THREE.Color(0x137C8B),
            shallow: new THREE.Color(0x5FD3C2),
            sky: new THREE.Color(0xBFE3E6),
            foam: new THREE.Color(0xF7F3E8),
            sun: new THREE.Color(0xFFE2B0),
        };
        this.sunDir = new THREE.Vector3(0.5, 0.6, 0.4).normalize();

        this.build(this.renderer.quality);
        this.renderer.onQualityChange((q) => this.rebuild(q));

        this.experience.addUpdate(7, () => this.update());
    }

    build(quality) {
        const tier = TIERS[quality] || TIERS.high;
        this.waveCount = tier.waveCount;

        const geometry = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, tier.segments, tier.segments);
        geometry.rotateX(-Math.PI / 2);

        // Bake distance-to-shore per vertex: drives shallows colour, foam and wave damping
        const pos = geometry.attributes.position;
        const shore = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
            shore[i] = shoreDistance(pos.getX(i), pos.getZ(i));
        }
        geometry.setAttribute('shoreDist', new THREE.BufferAttribute(shore, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uWaves: { value: wavesToUniform(4).map((w) => new THREE.Vector4(...w)) },
                uWaveCount: { value: tier.waveCount },
                uDeepColor: { value: this.palette.deep.clone() },
                uShallowColor: { value: this.palette.shallow.clone() },
                uSkyColor: { value: this.palette.sky.clone() },
                uFoamColor: { value: this.palette.foam.clone() },
                uSunColor: { value: this.palette.sun.clone() },
                uSunDir: { value: this.sunDir.clone() },
                ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            },
            defines: tier.detail ? { DETAIL: 1 } : {},
            fog: true,
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.name = 'ocean';
        this.mesh.frustumCulled = false;
        this.mesh.receiveShadow = false;
        this.scene.add(this.mesh);
        this.material = material;
    }

    rebuild(quality) {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.build(quality);
    }

    /** Surface height at world (x, z) for the current frame. */
    getHeight(x, z) {
        const damp = waveDamping(shoreDistance(x, z));
        return sampleHeight(x, z, this.timeSec, this.waveCount) * damp;
    }

    /** Surface normal at world (x, z). */
    getNormal(x, z, out = new THREE.Vector3()) {
        return sampleNormal(x, z, this.timeSec, out, this.waveCount);
    }

    /** Environment drives these as the light changes. */
    setLighting({ sunDir, sunColor, skyColor, deepColor, shallowColor }) {
        const u = this.material.uniforms;
        if (sunDir) u.uSunDir.value.copy(sunDir).normalize();
        if (sunColor) u.uSunColor.value.copy(sunColor);
        if (skyColor) u.uSkyColor.value.copy(skyColor);
        if (deepColor) u.uDeepColor.value.copy(deepColor);
        if (shallowColor) u.uShallowColor.value.copy(shallowColor);
    }

    update() {
        this.timeSec = this.time.elapsed / 1000;
        this.material.uniforms.uTime.value = this.timeSec * TIME_SCALE;
    }
}

const VERTEX = /* glsl */ `
    ${WAVES_GLSL}
    attribute float shoreDist;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vShore;
    varying float vHeight;
    #include <fog_pars_vertex>

    float waveDamping(float d) {
        float t = clamp(d / 9.0, 0.0, 1.0);
        float s = t * t * (3.0 - 2.0 * t);
        return 0.2 + 0.8 * s;
    }

    void main() {
        vec2 p = position.xz;
        float damp = waveDamping(shoreDist);

        vec3 d = gerstnerDisplacement(p) * damp;
        vec3 displaced = position + d;

        // Tangent-space finite differences for a stable normal
        float e = 0.45;
        vec3 tx = vec3(e, 0.0, 0.0) + gerstnerDisplacement(p + vec2(e, 0.0)) * damp - d;
        vec3 tz = vec3(0.0, 0.0, e) + gerstnerDisplacement(p + vec2(0.0, e)) * damp - d;
        vec3 n = normalize(cross(tz, tx));

        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = n;
        vShore = shoreDist;
        vHeight = d.y;

        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
    }
`;

const FRAGMENT = /* glsl */ `
    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uSkyColor;
    uniform vec3 uFoamColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vShore;
    varying float vHeight;
    #include <fog_pars_fragment>

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
        vec3 N = normalize(vNormal);

        #ifdef DETAIL
            // Fine ripples that the vertex grid is too coarse to carry
            float r1 = noise(vWorldPos.xz * 0.7 + vec2(uTime * 0.3, -uTime * 0.2));
            float r2 = noise(vWorldPos.xz * 1.9 - vec2(uTime * 0.25, uTime * 0.35));
            N = normalize(N + vec3((r1 - 0.5) * 0.09, 0.0, (r2 - 0.5) * 0.09));
        #endif

        vec3 V = normalize(cameraPosition - vWorldPos);
        float NdotV = max(dot(N, V), 0.0);
        float fresnel = 0.04 + 0.5 * pow(1.0 - NdotV, 4.0);

        // Depth colour: turquoise shallows, teal deep
        float shallow = 1.0 - smoothstep(0.0, 12.0, vShore);
        vec3 water = mix(uDeepColor, uShallowColor, shallow);
        water *= 1.0 + vHeight * 0.12;

        vec3 color = mix(water, uSkyColor, fresnel);

        // Sun glints. The swell facets are large and smooth, so a plain highlight
        // reads as white blobs; keep the lobe tight and break it with noise so it
        // becomes glitter, plus a faint broad sheen.
        vec3 H = normalize(uSunDir + V);
        float NdotH = max(dot(N, H), 0.0);
        float sheen = pow(NdotH, 60.0) * 0.06;
        #ifdef DETAIL
            float g1 = noise(vWorldPos.xz * 5.0 + vec2(uTime * 1.1, -uTime * 0.7));
            float g2 = noise(vWorldPos.xz * 11.0 - vec2(uTime * 0.9, uTime * 1.3));
            float glitter = smoothstep(0.55, 0.85, g1 * g2 * 1.6);
            float spec = pow(NdotH, 900.0) * glitter * 1.2;
        #else
            float spec = pow(NdotH, 700.0) * 0.35;
        #endif
        color += uSunColor * (spec + sheen);

        // Foam: lapping band along every shore + a whisper on the highest crests
        float fn = noise(vWorldPos.xz * 1.1 + vec2(uTime * 0.45, uTime * 0.2));
        float lap = sin(uTime * 1.4 + vWorldPos.x * 0.25 + vWorldPos.z * 0.2) * 0.6;
        float shoreFoam = 1.0 - smoothstep(0.0, 2.2 + fn * 1.8, vShore + lap);
        shoreFoam *= 0.4 + 0.6 * fn;
        // Crest foam: only the very top of stacked swells, broken into streaks so
        // it never reads as solid white patches
        float streak = noise(vWorldPos.xz * vec2(0.9, 3.5) + uTime * 0.5);
        float crest = smoothstep(0.68, 0.92, vHeight) * smoothstep(0.45, 0.8, streak);
        float foam = clamp(shoreFoam + crest * 0.22, 0.0, 1.0);
        color = mix(color, uFoamColor, foam);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
    }
`;
