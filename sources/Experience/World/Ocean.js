import * as THREE from 'three';
import Experience from '../Experience.js';
import { WAVES_GLSL, wavesToUniform, sampleHeight, TIME_SCALE } from './waves.js';
import { shoreDistance, waveDamping } from './layout.js';

const OCEAN_SIZE = 280;

const TIERS = {
    high: { segments: 220, waveCount: 4, detail: true, reflection: true },
    low:  { segments: 110, waveCount: 3, detail: false, reflection: false },
};

export default class Ocean {
    constructor() {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.sizes = this.experience.sizes;
        this.renderer = this.experience.renderer;

        this.timeSec = 0;
        // Weather scales the whole wave field (1 = calm Caribbean, ~1.8 squall)
        this.waveScale = 1;
        this.palette = {
            deep: new THREE.Color(0x137C8B),
            shallow: new THREE.Color(0x5FD3C2),
            sky: new THREE.Color(0xBFE3E6),
            foam: new THREE.Color(0xF7F3E8),
            sun: new THREE.Color(0xFFE2B0),
        };
        this.sunDir = new THREE.Vector3(0.5, 0.6, 0.4).normalize();

        this._v = new THREE.Vector3();
        this._up = new THREE.Vector3();
        this._look = new THREE.Vector3();

        this.build(this.renderer.quality);
        this.renderer.onQualityChange((q) => this.rebuild(q));
        this.renderer.addPreRender(() => this.renderReflection());
        this.sizes.on('resize', () => this.resizeReflection());

        this.experience.addUpdate(7, () => this.update());
    }

    build(quality) {
        const tier = TIERS[quality] || TIERS.high;
        this.waveCount = tier.waveCount;
        this.useReflection = tier.reflection;

        const geometry = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, tier.segments, tier.segments);
        geometry.rotateX(-Math.PI / 2);

        // Bake distance-to-shore per vertex: drives shallows colour, foam and wave damping
        const pos = geometry.attributes.position;
        const shore = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
            shore[i] = shoreDistance(pos.getX(i), pos.getZ(i));
        }
        geometry.setAttribute('shoreDist', new THREE.BufferAttribute(shore, 1));

        if (this.useReflection) this.setupReflection();

        const defines = {};
        if (tier.detail) defines.DETAIL = 1;
        if (this.useReflection) defines.REFLECTION = 1;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uWaves: { value: wavesToUniform(4).map((w) => new THREE.Vector4(...w)) },
                uWaveCount: { value: tier.waveCount },
                uWaveScale: { value: 1 },
                uDeepColor: { value: this.palette.deep.clone() },
                uShallowColor: { value: this.palette.shallow.clone() },
                uSkyColor: { value: this.palette.sky.clone() },
                uFoamColor: { value: this.palette.foam.clone() },
                uSunColor: { value: this.palette.sun.clone() },
                uSunDir: { value: this.sunDir.clone() },
                uSunUp: { value: 1 },
                uReflection: { value: this.reflectionRT ? this.reflectionRT.texture : null },
                uReflMatrix: { value: new THREE.Matrix4() },
                ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
            },
            defines,
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
        if (this.reflectionRT && !(TIERS[quality] || TIERS.high).reflection) {
            this.reflectionRT.dispose();
            this.reflectionRT = null;
        }
        this.build(quality);
    }

    // ── Planar reflection ────────────────────────────────────────────────

    reflectionSize() {
        const pr = this.sizes.pixelRatio;
        return {
            w: Math.max(256, Math.floor(this.sizes.width * pr * 0.5)),
            h: Math.max(144, Math.floor(this.sizes.height * pr * 0.5)),
        };
    }

    setupReflection() {
        if (this.reflectionRT) return;
        const { w, h } = this.reflectionSize();
        this.reflectionRT = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: true,
            stencilBuffer: false,
        });
        this.mirrorCamera = new THREE.PerspectiveCamera();
        // Keep everything below the waterline out of the mirror (island skirts, hull)
        this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.12);
    }

    resizeReflection() {
        if (!this.reflectionRT) return;
        const { w, h } = this.reflectionSize();
        this.reflectionRT.setSize(w, h);
    }

    renderReflection() {
        if (!this.useReflection || !this.reflectionRT || !this.mesh) return;
        const gl = this.renderer.instance;
        const camera = this.experience.camera.instance;
        const mirror = this.mirrorCamera;

        // Reflect the camera across y = 0
        mirror.position.set(camera.position.x, -camera.position.y, camera.position.z);
        this._look.set(0, 0, -1).applyQuaternion(camera.quaternion);
        this._look.y = -this._look.y;
        this._up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        this._up.y = -this._up.y;
        mirror.up.copy(this._up);
        mirror.lookAt(this._v.copy(mirror.position).add(this._look));
        mirror.fov = camera.fov;
        mirror.aspect = camera.aspect;
        mirror.near = camera.near;
        mirror.far = camera.far;
        mirror.updateProjectionMatrix();
        mirror.updateMatrixWorld();

        // World → mirror clip → [0,1] texture space
        const m = this.material.uniforms.uReflMatrix.value;
        m.set(
            0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0
        );
        m.multiply(mirror.projectionMatrix);
        m.multiply(mirror.matrixWorldInverse);

        const prevTarget = gl.getRenderTarget();
        const prevClip = gl.clippingPlanes;
        const prevShadowAuto = gl.shadowMap.autoUpdate;

        this.mesh.visible = false;
        gl.clippingPlanes = [this.clipPlane];
        gl.shadowMap.autoUpdate = false; // reuse this frame's shadow maps
        gl.setRenderTarget(this.reflectionRT);
        gl.clear();
        gl.render(this.scene, mirror);
        gl.setRenderTarget(prevTarget);
        gl.shadowMap.autoUpdate = prevShadowAuto;
        gl.clippingPlanes = prevClip;
        this.mesh.visible = true;
    }

    // ── Sampling (shared with physics) ───────────────────────────────────

    /** Surface height at world (x, z) for the current frame. */
    getHeight(x, z) {
        const damp = waveDamping(shoreDistance(x, z));
        return sampleHeight(x, z, this.timeSec, this.waveCount) * damp * this.waveScale;
    }

    /** Surface normal at world (x, z). */
    getNormal(x, z, out = new THREE.Vector3()) {
        const e = 0.35;
        const hL = this.getHeight(x - e, z);
        const hR = this.getHeight(x + e, z);
        const hD = this.getHeight(x, z - e);
        const hU = this.getHeight(x, z + e);
        out.set(hL - hR, 2 * e, hD - hU);
        return out.normalize();
    }

    /** Environment drives these as the light changes. */
    setLighting({ sunDir, sunColor, skyColor, deepColor, shallowColor, sunUp }) {
        const u = this.material.uniforms;
        if (sunDir) u.uSunDir.value.copy(sunDir).normalize();
        if (sunColor) u.uSunColor.value.copy(sunColor);
        if (skyColor) u.uSkyColor.value.copy(skyColor);
        if (deepColor) u.uDeepColor.value.copy(deepColor);
        if (shallowColor) u.uShallowColor.value.copy(shallowColor);
        if (sunUp !== undefined) u.uSunUp.value = sunUp;
    }

    update() {
        this.timeSec = this.time.elapsed / 1000;
        this.material.uniforms.uTime.value = this.timeSec * TIME_SCALE;
        this.material.uniforms.uWaveScale.value = this.waveScale;
    }
}

const VERTEX = /* glsl */ `
    ${WAVES_GLSL}
    attribute float shoreDist;
    uniform float uWaveScale;

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
        float damp = waveDamping(shoreDist) * uWaveScale;

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
    uniform float uSunUp;
    #ifdef REFLECTION
        uniform sampler2D uReflection;
        uniform mat4 uReflMatrix;
    #endif

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

    float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        #ifdef DETAIL
            for (int i = 0; i < 4; i++) {
        #else
            for (int i = 0; i < 2; i++) {
        #endif
            v += a * noise(p);
            p = p * 2.1 + vec2(3.7, 1.3);
            a *= 0.5;
        }
        return v;
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
        float fresnel = 0.04 + 0.55 * pow(1.0 - NdotV, 4.0);

        // Depth colour: turquoise shallows, teal deep; troughs darker, crests lit
        float shallow = 1.0 - smoothstep(0.0, 12.0, vShore);
        vec3 water = mix(uDeepColor, uShallowColor, shallow);
        water *= mix(0.9, 1.12, smoothstep(-0.7, 0.7, vHeight));

        // Sky / scene reflection
        vec3 skyRefl = uSkyColor;
        #ifdef REFLECTION
            vec4 rp = uReflMatrix * vec4(vWorldPos, 1.0);
            vec2 ruv = rp.xy / rp.w + N.xz * 0.06;
            ruv = clamp(ruv, 0.002, 0.998);
            vec3 refl = texture2D(uReflection, ruv).rgb;
            skyRefl = mix(uSkyColor, refl, 0.82);
        #endif
        vec3 color = mix(water, skyRefl, fresnel);

        // Light through the crests when looking toward the sun
        float back = pow(max(dot(V, -uSunDir), 0.0), 3.0);
        float sss = back * smoothstep(0.0, 0.8, vHeight) * (1.0 - fresnel) * uSunUp;
        color += uShallowColor * 1.2 * sss * 0.55;

        // Caustics dancing on the shallows
        #ifdef DETAIL
            vec2 cuv = vWorldPos.xz * 0.38;
            float c1 = noise(cuv + vec2(uTime * 0.35, uTime * 0.2));
            float c2 = noise(cuv * 1.7 - vec2(uTime * 0.25, -uTime * 0.3));
            float caustic = pow(max(0.0, 1.0 - abs(c1 - c2) * 4.5), 3.0);
            float sand = 1.0 - smoothstep(0.0, 7.0, vShore);
            color += uSunColor * caustic * sand * 0.35 * uSunUp;
        #endif

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
        color += uSunColor * (spec + sheen) * uSunUp;

        // Foam: a lacy fbm texture, revealed along every shore (lapping) and on
        // the tops of stacked swells (broken streaks, never solid patches)
        float lace = fbm(vWorldPos.xz * 1.6 + vec2(uTime * 0.3, uTime * 0.15));
        float bubbles = smoothstep(0.38, 0.72, lace);
        float fn = noise(vWorldPos.xz * 1.1 + vec2(uTime * 0.45, uTime * 0.2));
        float lap = sin(uTime * 1.4 + vWorldPos.x * 0.25 + vWorldPos.z * 0.2) * 0.6;
        float shoreMask = 1.0 - smoothstep(0.0, 2.4 + fn * 1.8, vShore + lap);
        float shoreFoam = shoreMask * (0.3 + 0.7 * bubbles);
        float streak = noise(vWorldPos.xz * vec2(0.9, 3.5) + uTime * 0.5);
        float crest = smoothstep(0.62, 0.9, vHeight) * smoothstep(0.45, 0.8, streak) * (0.5 + 0.5 * bubbles);
        float foam = clamp(shoreFoam + crest * 0.3, 0.0, 1.0);
        color = mix(color, uFoamColor, foam);

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
    }
`;
