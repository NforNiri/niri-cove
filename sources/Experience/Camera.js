import * as THREE from 'three';
import gsap from 'gsap';
import Experience from './Experience.js';
import CameraControls from 'camera-controls';
import { ISLANDS, SPAWN } from './World/layout.js';

CameraControls.install({ THREE: THREE });

// Default follow framing: slightly lower and closer than the space build so the
// water surface fills more of the frame.
const FOLLOW = { distance: 22, elevation: 10 };
const BASE_FOV = 42;
const PORTRAIT_FOV = 60;

// Order the intro tour visits the islands (clockwise around the lagoon)
const TOUR_ORDER = ['about', 'work', 'creative', 'resume', 'contact'];
const TOUR_DURATION = 14;

export default class Camera {
    constructor() {
        this.experience = Experience.getInstance();
        this.sizes = this.experience.sizes;
        this.scene = this.experience.scene;
        this.canvas = this.experience.canvas;
        this.time = this.experience.time;

        // Camera "feel" state
        this.baseFov = BASE_FOV;
        this.fovBoost = 0;
        this.shake = 0;
        this.roll = 0;
        this.cinematicMode = false;
        this.cinematic = null;

        this._tmp = new THREE.Vector3();
        this._tmp2 = new THREE.Vector3();

        this.setInstance();
        this.setControls();

        this.experience.addUpdate(0, () => this.update());
        this.sizes.on('resize', () => this.resize());
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(BASE_FOV, this.sizes.width / this.sizes.height, 0.1, 400);
        this.instance.position.set(0, FOLLOW.elevation, FOLLOW.distance);
        this.scene.add(this.instance);
    }

    setControls() {
        this.controls = new CameraControls(this.instance, this.canvas);
        this.controls.smoothTime = 0.25;
        this.controls.draggingSmoothTime = 0.12;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 60;
        // Keep the camera above the water and below straight-down
        this.controls.minPolarAngle = 0.35;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.12;
        this.controls.setLookAt(0, FOLLOW.elevation, this.followDistance(), 0, 0, 0);
        this.resize();
    }

    resize() {
        const aspect = this.sizes.width / this.sizes.height;
        this.instance.aspect = aspect;
        // Portrait phones lose most of the horizontal view; widen the lens so the
        // boat and the next island still fit in frame
        this.baseFov = aspect < 0.9 ? PORTRAIT_FOV : BASE_FOV;
        this.instance.fov = this.baseFov + this.fovBoost;
        this.instance.updateProjectionMatrix();
    }

    /** Follow distance scaled for the current viewport shape. */
    followDistance() {
        const aspect = this.sizes.width / this.sizes.height;
        return aspect < 0.9 ? FOLLOW.distance * 1.15 : FOLLOW.distance;
    }

    /** Kick the camera; decays on its own. 0..1 */
    addShake(amount) {
        this.shake = Math.min(1, this.shake + amount);
    }

    // ── Intro tour ───────────────────────────────────────────────────────

    /**
     * Intro: a high establishing shot, then a sweep around the outside of the
     * archipelago past every island (emitting `intro:island` as each one comes
     * into frame), ending behind the boat in the lagoon. Skippable.
     */
    cinematicFlyover({ onDone } = {}) {
        this.cinematicMode = true;
        this.controls.enabled = false;

        const islands = TOUR_ORDER.map((id) => ISLANDS.find((i) => i.id === id)).filter(Boolean);

        const camPts = [new THREE.Vector3(-30, 78, 128)];
        const tgtPts = [new THREE.Vector3(0, 0, -6)];
        for (const isl of islands) {
            // Outward from the lagoon (opposite the pier), so the lagoon and the
            // other islands sit in the background of every shot
            const ox = -isl.dockDir.x;
            const oz = -isl.dockDir.z;
            const d = isl.radius + 17;
            camPts.push(new THREE.Vector3(isl.x + ox * d, 15, isl.z + oz * d));
            tgtPts.push(new THREE.Vector3(isl.x, 1.2, isl.z));
        }
        camPts.push(new THREE.Vector3(SPAWN.x, FOLLOW.elevation, SPAWN.z + this.followDistance()));
        tgtPts.push(new THREE.Vector3(SPAWN.x, 0.6, SPAWN.z));

        this.cinematic = {
            pos: new THREE.CatmullRomCurve3(camPts, false, 'centripetal', 0.5),
            tgt: new THREE.CatmullRomCurve3(tgtPts, false, 'centripetal', 0.5),
            progress: 0,
            islands,
            stamped: new Set(),
            onDone,
        };
        this.cinematic.pos.arcLengthDivisions = 400;
        this.cinematic.tgt.arcLengthDivisions = 400;

        this.applyCinematic();
        this.cinematicTween = gsap.to(this.cinematic, {
            progress: 1,
            duration: TOUR_DURATION,
            ease: 'power1.inOut',
            onUpdate: () => this.applyCinematic(),
            onComplete: () => this.endCinematic(),
        });
    }

    /** Fast-forward the tour to its final shot. */
    skipCinematic() {
        if (!this.cinematicMode || !this.cinematic || this.cinematic.skipping) return;
        this.cinematic.skipping = true;
        if (this.cinematicTween) this.cinematicTween.kill();
        // Stamp everything we would have passed
        for (const isl of this.cinematic.islands) this.stampIsland(isl);
        this.cinematicTween = gsap.to(this.cinematic, {
            progress: 1,
            duration: 1.4,
            ease: 'power2.inOut',
            onUpdate: () => this.applyCinematic(),
            onComplete: () => this.endCinematic(),
        });
    }

    applyCinematic() {
        const c = this.cinematic;
        if (!c) return;
        const t = THREE.MathUtils.clamp(c.progress, 0, 1);
        const p = c.pos.getPointAt(t, this._tmp);
        const look = c.tgt.getPointAt(t, this._tmp2);
        this.instance.position.copy(p);
        this.instance.lookAt(look);

        for (const isl of c.islands) {
            if (c.stamped.has(isl.id)) continue;
            if (Math.hypot(look.x - isl.x, look.z - isl.z) < 7) this.stampIsland(isl);
        }
    }

    stampIsland(isl) {
        const c = this.cinematic;
        if (!c || c.stamped.has(isl.id)) return;
        c.stamped.add(isl.id);
        this.experience.emit('intro:island', isl.id);
    }

    endCinematic() {
        const c = this.cinematic;
        if (!c) return;
        this.cinematicTween = null;
        const p = c.pos.getPointAt(1, this._tmp);
        const look = c.tgt.getPointAt(1, this._tmp2);
        this.controls.setLookAt(p.x, p.y, p.z, look.x, look.y, look.z, false);
        this.controls.update(0);
        this.controls.enabled = true;
        this.controls.smoothTime = 0.7;
        this.cinematicMode = false;
        this.cinematic = null;
        setTimeout(() => { this.controls.smoothTime = 0.25; }, 1500);
        this.experience.emit('intro:done');
        if (c.onDone) c.onDone();
    }

    // ── Frame update ─────────────────────────────────────────────────────

    /**
     * Swing the orbit behind a boat heading `yaw` (Boat.reset convention) so a
     * teleport lands with the island ahead, not behind the lens.
     */
    frameBehind(yaw, snap = false) {
        if (this.cinematicMode) return;
        // Boat forward is (-sin yaw, -cos yaw); camera-controls azimuth puts the
        // camera at (sin az, cos az) from the target, i.e. behind for az = yaw.
        this.controls.rotateAzimuthTo(yaw, !snap);
    }

    update() {
        const dt = Math.min(this.time.delta / 1000, 0.1);

        if (this.cinematicMode) return;

        const world = this.experience.world;
        const boat = world ? world.boat : null;
        const controls = this.experience.controls;

        if (boat && boat.rigidBody) {
            const p = boat.getPosition();
            // Follow the hull's XZ but keep the pivot on a steady height so the
            // camera does not bob with every wave. Lead the boat a little at speed
            // so there is more water ahead than behind.
            const lead = THREE.MathUtils.clamp(boat.forwardSpeed, -3, 12) * 0.22;
            const f = boat.forward;
            this.controls.moveTo(p.x + f.x * lead, 0.6, p.z + f.z * lead, true);
        }

        this.controls.update(dt);

        // Lens stretch under full sail
        const boosting = boat && controls && controls.keys.boost && boat.forwardSpeed > 1;
        const targetBoost = boosting ? 6 * Math.min(boat.speed / 11.5, 1) : 0;
        this.fovBoost += (targetBoost - this.fovBoost) * Math.min(1, dt * 3);
        const fov = this.baseFov + this.fovBoost;
        if (Math.abs(fov - this.instance.fov) > 0.01) {
            this.instance.fov = fov;
            this.instance.updateProjectionMatrix();
        }

        // Tiny roll following the hull's heel
        const targetRoll = world && world.boatVisual ? world.boatVisual.lean * 0.35 : 0;
        this.roll += (targetRoll - this.roll) * Math.min(1, dt * 4);
        if (Math.abs(this.roll) > 0.0005) this.instance.rotateZ(this.roll);

        // Micro-shake (anchor, boost, bumps)
        if (this.shake > 0.002) {
            const s = this.shake * 0.012;
            this.instance.rotateX((Math.random() - 0.5) * s);
            this.instance.rotateY((Math.random() - 0.5) * s);
            this.shake *= Math.exp(-dt * 5.5);
        } else {
            this.shake = 0;
        }
    }
}
