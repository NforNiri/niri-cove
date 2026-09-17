import * as THREE from 'three';
import Experience from '../Experience.js';

// One full day is 14 minutes; daylight takes 72% of it so a typical visit
// starts in the afternoon, drifts into golden hour and only then into a short night.
const CYCLE_MS = 14 * 60 * 1000;
const DAY_SHARE = 0.72;
const START_T = 0.46;

const PALETTE = {
    day:    { zenith: 0x3FA9C9, horizon: 0xBFE3E6, sun: 0xFFEBC7, deep: 0x137C8B, shallow: 0x5FD3C2 },
    golden: { zenith: 0x5E9EC4, horizon: 0xFFC48A, sun: 0xFFB070, deep: 0x1B6F85, shallow: 0x6AC7BB },
    night:  { zenith: 0x0B1A33, horizon: 0x1E3A5F, sun: 0x8FA9D6, deep: 0x0A2E3F, shallow: 0x1F5D66 },
};

const toColor = (hex) => new THREE.Color(hex);
for (const key of Object.keys(PALETTE)) {
    for (const k of Object.keys(PALETTE[key])) PALETTE[key][k] = toColor(PALETTE[key][k]);
}

export default class Environment {
    constructor(ocean) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.renderer = this.experience.renderer;
        this.ocean = ocean;

        this.sunDir = new THREE.Vector3(0.5, 0.6, 0.4).normalize();
        this.nightFactor = 0;
        this.goldenFactor = 0;

        this._c1 = new THREE.Color();
        this._c2 = new THREE.Color();
        this._zenith = new THREE.Color();
        this._horizon = new THREE.Color();
        this._sun = new THREE.Color();
        this._deep = new THREE.Color();
        this._shallow = new THREE.Color();

        this.scene.fog = new THREE.Fog(0xBFE3E6, 70, 260);

        this.setLights();
        this.setSky();
        this.renderer.onQualityChange((q) => this.applyQuality(q));
        this.applyQuality(this.renderer.quality);

        this.experience.addUpdate(8, () => this.update());
        this.update();
    }

    setLights() {
        this.sunLight = new THREE.DirectionalLight(0xFFEBC7, 2.6);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.set(2048, 2048);
        this.sunLight.shadow.camera.near = 5;
        this.sunLight.shadow.camera.far = 160;
        this.sunLight.shadow.camera.left = -45;
        this.sunLight.shadow.camera.right = 45;
        this.sunLight.shadow.camera.top = 45;
        this.sunLight.shadow.camera.bottom = -45;
        this.sunLight.shadow.bias = -0.0008;
        this.sunLight.shadow.normalBias = 0.02;
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        this.hemiLight = new THREE.HemisphereLight(0xBFE3E6, 0x2C7A85, 0.75);
        this.scene.add(this.hemiLight);

        this.ambientLight = new THREE.AmbientLight(0xFFF1DC, 0.35);
        this.scene.add(this.ambientLight);
    }

    setSky() {
        const geo = new THREE.SphereGeometry(340, 32, 16);
        this.skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            uniforms: {
                uZenith: { value: new THREE.Color() },
                uHorizon: { value: new THREE.Color() },
                uSunColor: { value: new THREE.Color() },
                uSunDir: { value: new THREE.Vector3(0, 1, 0) },
                uNight: { value: 0 },
                uTime: { value: 0 },
            },
            vertexShader: /* glsl */ `
                varying vec3 vDir;
                void main() {
                    // Dome is re-centred on the camera every frame, so the local
                    // position is already the view direction
                    vDir = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uZenith;
                uniform vec3 uHorizon;
                uniform vec3 uSunColor;
                uniform vec3 uSunDir;
                uniform float uNight;
                uniform float uTime;
                varying vec3 vDir;

                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float noise2(vec2 p) {
                    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
                }

                void main() {
                    vec3 d = normalize(vDir);
                    float h = d.y;
                    // Haze band hugs the horizon; the camera mostly sees the
                    // lowest 15° of sky so the blue has to arrive quickly
                    float t = pow(clamp(h, 0.0, 1.0), 0.3);
                    vec3 col = mix(uHorizon, uZenith, t);
                    col = mix(col, uHorizon * 0.85, clamp(-h * 3.0, 0.0, 1.0));

                    float s = max(dot(d, uSunDir), 0.0);
                    col += uSunColor * (pow(s, 400.0) * 2.0 + pow(s, 10.0) * 0.28);

                    #ifdef CLOUDS
                        if (h > 0.02) {
                            vec2 uv = d.xz / (h + 0.25) * 1.4 + vec2(uTime * 0.004, uTime * 0.002);
                            float n = noise2(uv) * 0.55 + noise2(uv * 2.3 + 7.0) * 0.3 + noise2(uv * 5.1 + 3.0) * 0.15;
                            float cloud = smoothstep(0.56, 0.74, n) * smoothstep(0.02, 0.18, h);
                            vec3 cloudCol = mix(vec3(1.0, 0.97, 0.92), uSunColor, 0.35) * (1.0 - uNight * 0.85);
                            col = mix(col, cloudCol, cloud * 0.85);
                        }
                    #endif

                    if (uNight > 0.01 && h > 0.0) {
                        float star = hash(floor(d * 260.0));
                        float twinkle = 0.6 + 0.4 * sin(uTime * 2.5 + star * 80.0);
                        col += step(0.994, star) * uNight * smoothstep(0.0, 0.25, h) * twinkle;
                    }

                    gl_FragColor = vec4(col, 1.0);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `,
        });
        this.sky = new THREE.Mesh(geo, this.skyMat);
        this.sky.name = 'sky';
        this.sky.frustumCulled = false;
        this.scene.add(this.sky);
    }

    applyQuality(quality) {
        const high = quality === 'high';
        this.sunLight.castShadow = high;
        const wantClouds = high;
        const hasClouds = !!this.skyMat.defines.CLOUDS;
        if (wantClouds !== hasClouds) {
            if (wantClouds) this.skyMat.defines.CLOUDS = 1;
            else delete this.skyMat.defines.CLOUDS;
            this.skyMat.needsUpdate = true;
        }
    }

    /**
     * 0..1 progress through the (warped) day. Daylight = [0, DAY_SHARE).
     */
    sunElevation() {
        const t = ((this.time.elapsed / CYCLE_MS) + START_T) % 1;
        let phase;
        if (t < DAY_SHARE) phase = (t / DAY_SHARE) * Math.PI;
        else phase = Math.PI + ((t - DAY_SHARE) / (1 - DAY_SHARE)) * Math.PI;
        return { elevation: Math.sin(phase), t };
    }

    update() {
        const { elevation, t } = this.sunElevation();
        const above = Math.max(elevation, 0);

        // Golden band: sun low but above the horizon
        this.goldenFactor = 1 - THREE.MathUtils.smoothstep(above, 0.05, 0.55);
        this.nightFactor = 1 - THREE.MathUtils.smoothstep(elevation, -0.08, 0.12);

        // Sun sweeps east → west; peaks at 58° so shadows stay long and painterly
        const azimuth = (t / DAY_SHARE) * Math.PI + Math.PI * 0.15;
        const elevAngle = Math.max(elevation, -0.15) * THREE.MathUtils.degToRad(58);
        this.sunDir.set(
            Math.cos(azimuth) * Math.cos(elevAngle),
            Math.sin(elevAngle),
            Math.sin(azimuth) * Math.cos(elevAngle) * 0.7
        ).normalize();

        // Blend palettes: day → golden → night
        const lerp3 = (target, key) => {
            this._c1.copy(PALETTE.day[key]).lerp(PALETTE.golden[key], this.goldenFactor);
            target.copy(this._c1).lerp(PALETTE.night[key], this.nightFactor);
            return target;
        };
        lerp3(this._zenith, 'zenith');
        lerp3(this._horizon, 'horizon');
        lerp3(this._sun, 'sun');
        lerp3(this._deep, 'deep');
        lerp3(this._shallow, 'shallow');

        // Directional light
        const boat = this.experience.world ? this.experience.world.boat : null;
        const focus = boat ? boat.getPosition() : { x: 0, y: 0, z: 0 };
        this.sunLight.position.set(
            focus.x + this.sunDir.x * 90,
            Math.max(this.sunDir.y, 0.08) * 90,
            focus.z + this.sunDir.z * 90
        );
        this.sunLight.target.position.set(focus.x, 0, focus.z);
        this.sunLight.intensity = THREE.MathUtils.lerp(0.2, 1.15, 1 - this.nightFactor) * (0.75 + above * 0.25);
        this.sunLight.color.copy(this._sun);

        this.hemiLight.color.copy(this._horizon);
        this.hemiLight.groundColor.copy(this._deep);
        this.hemiLight.intensity = THREE.MathUtils.lerp(0.25, 0.55, 1 - this.nightFactor);
        this.ambientLight.intensity = THREE.MathUtils.lerp(0.12, 0.22, 1 - this.nightFactor);

        // Water reflects a blend of horizon and zenith, not the bright haze alone
        this._c2.copy(this._horizon).lerp(this._zenith, 0.55);

        // Sky + fog
        const sky = this.skyMat.uniforms;
        sky.uZenith.value.copy(this._zenith);
        sky.uHorizon.value.copy(this._horizon);
        sky.uSunColor.value.copy(this._sun);
        sky.uSunDir.value.copy(this.sunDir);
        sky.uNight.value = this.nightFactor;
        sky.uTime.value = this.time.elapsed / 1000;
        const cam = this.experience.camera?.instance;
        if (cam) this.sky.position.copy(cam.position);

        this.scene.fog.color.copy(this._horizon);
        this.renderer.instance.setClearColor(this._horizon);
        this.renderer.setMood(this.nightFactor);

        if (this.ocean) {
            this.ocean.setLighting({
                sunDir: this.sunDir,
                sunColor: this._sun,
                skyColor: this._c2,
                deepColor: this._deep,
                shallowColor: this._shallow,
                sunUp: 1 - this.nightFactor * 0.85,
            });
        }
    }
}
