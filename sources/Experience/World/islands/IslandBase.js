import * as THREE from 'three';
import Experience from '../../Experience.js';
import { cloneModel, fitFootprint } from '../../Utils/models.js';
import { PIER_INSET, PIER_LENGTH } from '../layout.js';

const SAND = new THREE.Color(0xE6CF9C);
const SAND_WET = new THREE.Color(0xC4A26C);
const GRASS = new THREE.Color(0x7FB069);
const GRASS_DEEP = new THREE.Color(0x4F8A45);
const ROCK = new THREE.Color(0x8C8578);

// Kenney Pirate Kit GLBs are authored chunky (barrel ≈ 1.3 units, palm ≈ 4.2).
// 0.6 sits props nicely against the 4.2-unit player boat.
export const KIT_SCALE = 0.6;

/**
 * Procedural low-poly island with a sand ring, a grassy plateau and an
 * underwater skirt, plus helpers to dress it with Kenney props.
 */
export default class IslandBase {
    constructor(data, { plateau = 1.9, plateauRadius = 0.62, seed = 1, rockiness = 0 } = {}) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.physics = this.experience.physics;
        this.resources = this.experience.resources;
        this.renderer = this.experience.renderer;
        this.time = this.experience.time;

        this.data = data;
        this.radius = data.radius;
        this.plateau = plateau;
        this.plateauRadius = plateauRadius;
        this.rockiness = rockiness;
        this.seed = seed;

        this.group = new THREE.Group();
        this.group.name = `island-${data.id}`;
        this.group.position.set(data.x, 0, data.z);
        this.scene.add(this.group);

        this.animated = [];
        this.lights = [];

        this.buildTerrain();
        this.buildCollider();
        this.buildDock();
        this.dress();
        this.dressShore();
        this.applyQuality(this.renderer.quality);
        this.renderer.onQualityChange((q) => this.applyQuality(q));
    }

    // ── Terrain ─────────────────────────────────────────────────────────

    /** Deterministic pseudo-random in [0,1) for this island. */
    rand(i) {
        const x = Math.sin(i * 12.9898 + this.seed * 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    /** Effective shoreline radius at angle a (island is not a perfect circle). */
    shoreRadius(a) {
        const r = this.radius;
        return r * (1 + 0.07 * Math.sin(3 * a + this.seed) + 0.045 * Math.sin(7 * a + this.seed * 2.3));
    }

    /** Terrain height at local (x, z). */
    heightAt(x, z) {
        const a = Math.atan2(z, x);
        const d = Math.hypot(x, z);
        const R = this.shoreRadius(a);
        const t = d / R;
        if (t >= 1) {
            // underwater skirt
            return 0.25 - (t - 1) * R * 0.8;
        }
        // Shore lip slightly above the (damped) waves, rising to the plateau
        const inland = 1 - t;
        // Beach is the outer ~22% of the radius; grass takes over quickly after
        const rise = THREE.MathUtils.smoothstep(inland, 0.1, Math.max(0.22, 1 - this.plateauRadius)) * this.plateau;
        const bumps = (Math.sin(x * 0.9 + this.seed) * Math.cos(z * 0.8 - this.seed)) * 0.12 * inland;
        return 0.25 + rise + bumps;
    }

    buildTerrain() {
        const rings = 22;
        const segments = 56;
        const skirt = 4.5;
        const positions = [];
        const colors = [];
        const indices = [];

        for (let ri = 0; ri <= rings; ri++) {
            const tr = ri / rings;
            for (let si = 0; si <= segments; si++) {
                const a = (si / segments) * Math.PI * 2;
                const R = this.shoreRadius(a) + skirt;
                // more resolution near the shore
                const d = Math.pow(tr, 0.8) * R;
                const x = Math.cos(a) * d;
                const z = Math.sin(a) * d;
                const y = this.heightAt(x, z);
                positions.push(x, y, z);

                const c = this.colorAt(x, y, z);
                colors.push(c.r, c.g, c.b);
            }
        }

        for (let ri = 0; ri < rings; ri++) {
            for (let si = 0; si < segments; si++) {
                const a = ri * (segments + 1) + si;
                const b = a + segments + 1;
                // atan2 sweeps clockwise when seen from above, so wind CCW → +Y normals
                indices.push(a, a + 1, b);
                indices.push(b, a + 1, b + 1);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.95,
            metalness: 0,
            flatShading: true,
        });

        this.terrain = new THREE.Mesh(geo, mat);
        this.terrain.receiveShadow = true;
        this.terrain.castShadow = false;
        this.group.add(this.terrain);
    }

    colorAt(x, y, z) {
        const c = new THREE.Color();
        const d = Math.hypot(x, z);
        const wet = THREE.MathUtils.smoothstep(y, -0.3, 0.45);
        if (y < 0.45) {
            c.copy(SAND_WET).lerp(SAND, wet);
        } else {
            const g = THREE.MathUtils.smoothstep(y, 0.45, 1.0);
            c.copy(SAND).lerp(GRASS, g);
            const deep = THREE.MathUtils.smoothstep(y, 1.3, this.plateau + 0.2);
            c.lerp(GRASS_DEEP, deep * 0.6);
            if (this.rockiness > 0) {
                const r = this.rand(Math.floor(x * 3.1) * 17 + Math.floor(z * 3.1));
                if (r < this.rockiness * (y / (this.plateau + 0.25))) c.lerp(ROCK, 0.7);
            }
        }
        // tiny per-vertex variation keeps the flat shading lively
        const v = (this.rand(Math.floor(x * 5) + Math.floor(z * 5) * 31 + d) - 0.5) * 0.06;
        c.offsetHSL(0, 0, v);
        return c;
    }

    buildCollider() {
        // Slightly inset so the hull kisses the sand instead of an invisible wall
        const r = this.radius * 0.94;
        this.physics.addStaticShapes([
            { type: 'cylinder', pos: [this.data.x, -0.5, this.data.z], size: [r, 2.5] },
        ]);
    }

    // ── Dock ─────────────────────────────────────────────────────────────

    buildDock() {
        const { x: ux, z: uz } = this.data.dockDir;
        this.dockDir = new THREE.Vector2(ux, uz);
        this.dockYaw = Math.atan2(ux, uz);

        // Pier = a row of dock tiles running from the sand out over the water
        const dockGroup = new THREE.Group();
        const tiles = 4;
        const tile = PIER_LENGTH / tiles;
        const tileScale = tile / 2.5;
        const startR = this.radius - PIER_INSET;
        for (let i = 0; i < tiles; i++) {
            const model = cloneModel(this.resources, i === tiles - 1 ? 'structure-platform-dock-small' : 'structure-platform-dock');
            if (!model) continue;
            model.scale.setScalar(tileScale);
            model.position.set(0, 0, i * tile);
            dockGroup.add(model);
        }
        dockGroup.position.set(ux * startR, 0.35, uz * startR);
        dockGroup.rotation.y = this.dockYaw;
        this.group.add(dockGroup);
        this.dockGroup = dockGroup;
        this.dockLength = PIER_LENGTH;

        // Pier collider so the boat can nudge it without passing through
        const midR = startR + this.dockLength / 2;
        this.physics.addStaticShapes([
            { type: 'box', pos: [this.data.x + ux * midR, 0, this.data.z + uz * midR], size: [1.1, 1.2, this.dockLength / 2], rotY: this.dockYaw },
        ]);

        const tipR = startR + this.dockLength;
        this.dockTip = new THREE.Vector3(this.data.x + ux * tipR, 0, this.data.z + uz * tipR);
    }

    // ── Placement helpers ───────────────────────────────────────────────

    /**
     * Place a Kenney model at local island coordinates. Y snaps to terrain
     * unless given. Returns the placed object (or null if the model is missing).
     */
    place(name, x, z, { scale = 1, rotY = 0, y = null, footprint = null, uniqueMaterial = false, shadows = true } = {}) {
        const model = cloneModel(this.resources, name, { uniqueMaterial, shadows });
        if (!model) return null;

        if (footprint) {
            fitFootprint(model, footprint, 0);
        } else {
            model.scale.setScalar(scale * KIT_SCALE);
        }

        const holder = new THREE.Group();
        holder.position.set(x, y === null ? this.heightAt(x, z) - 0.04 : y, z);
        holder.rotation.y = rotY;
        holder.add(model);
        this.group.add(holder);
        return holder;
    }

    /** Position on the island at polar coords relative to the dock direction. */
    polar(dist, angleOffset) {
        const base = Math.atan2(this.dockDir.y, this.dockDir.x);
        const a = base + angleOffset;
        return { x: Math.cos(a) * dist, z: Math.sin(a) * dist };
    }

    /** Scatter palms around the plateau edge. */
    palms(count, { minR = null, maxR = null, start = 0 } = {}) {
        const r0 = minR ?? this.radius * 0.45;
        const r1 = maxR ?? this.radius * 0.82;
        const types = ['palm-straight', 'palm-bend', 'palm-detailed-straight', 'palm-detailed-bend'];
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + this.rand(start + i) * 0.7;
            // keep the dock approach clear
            const toDock = Math.abs(Math.atan2(Math.sin(a - Math.atan2(this.dockDir.y, this.dockDir.x)), Math.cos(a - Math.atan2(this.dockDir.y, this.dockDir.x))));
            if (toDock < 0.55) continue;
            const d = THREE.MathUtils.lerp(r0, r1, this.rand(start + i * 7));
            const name = types[Math.floor(this.rand(start + i * 13) * types.length)];
            const scale = 0.9 + this.rand(start + i * 3) * 0.5;
            const palm = this.place(name, Math.cos(a) * d, Math.sin(a) * d, { scale, rotY: this.rand(i) * Math.PI * 2 });
            if (palm) this.animated.push({ obj: palm, kind: 'sway', phase: this.rand(i * 5) * 6.28 });
        }
    }

    /** Scatter sand patches / grass tufts / rocks. */
    scatter(names, count, { minR = 0.2, maxR = 0.9, start = 100, scale = 1 } = {}) {
        for (let i = 0; i < count; i++) {
            const a = this.rand(start + i) * Math.PI * 2;
            const d = THREE.MathUtils.lerp(minR, maxR, this.rand(start + i * 3)) * this.radius;
            const name = names[Math.floor(this.rand(start + i * 11) * names.length)];
            this.place(name, Math.cos(a) * d, Math.sin(a) * d, {
                scale: scale * (0.8 + this.rand(start + i * 5) * 0.5),
                rotY: this.rand(start + i * 2) * Math.PI * 2,
            });
        }
    }

    /** Warm practical light (torch/lantern/campfire). Only lit on HIGH or when marked essential. */
    addLight(x, y, z, { color = 0xFFA640, intensity = 4, distance = 12, flicker = 0, essential = false } = {}) {
        const light = new THREE.PointLight(color, intensity, distance, 1.8);
        light.position.set(x, y, z);
        this.group.add(light);
        this.lights.push({ light, base: intensity, flicker, essential, phase: Math.random() * 10 });
        return light;
    }

    applyQuality(quality) {
        const high = quality === 'high';
        for (const l of this.lights) {
            l.light.visible = high || l.essential;
        }
    }

    /**
     * Shared beach dressing every island gets on top of its own theme:
     * sand tufts along the beach ring and a few wet rocks at the waterline.
     */
    dressShore() {
        const low = this.renderer.quality === 'low';
        this.scatter(['patch-sand', 'patch-sand-foliage', 'grass-plant'], low ? 4 : 8, { minR: 0.8, maxR: 0.92, start: 5000 + this.seed * 17, scale: 0.9 });
        this.scatter(['rocks-sand-a', 'rocks-sand-b', 'rocks-sand-c'], low ? 2 : 4, { minR: 0.95, maxR: 1.02, start: 6000 + this.seed * 23, scale: 0.8 });
    }

    // ── Hooks ────────────────────────────────────────────────────────────

    /** Override per island. */
    dress() {}

    update() {
        const t = this.time.elapsed / 1000;
        for (const a of this.animated) {
            if (a.kind === 'sway') {
                a.obj.rotation.z = Math.sin(t * 0.9 + a.phase) * 0.025;
                a.obj.rotation.x = Math.cos(t * 0.7 + a.phase) * 0.02;
            } else if (a.kind === 'spin') {
                a.obj.rotation.y += a.speed * (this.time.delta / 1000);
            } else if (a.kind === 'bob') {
                a.obj.position.y = a.baseY + Math.sin(t * 1.4 + a.phase) * a.amount;
            }
        }
        const night = this.experience.world?.environment?.nightFactor ?? 0;
        for (const l of this.lights) {
            if (!l.light.visible) continue;
            const flick = l.flicker ? 1 + Math.sin(t * 9 + l.phase) * l.flicker + Math.sin(t * 23 + l.phase * 2) * l.flicker * 0.5 : 1;
            l.light.intensity = l.base * flick * (0.35 + night * 0.65);
        }
    }
}
