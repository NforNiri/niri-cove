import * as THREE from 'three';
import Experience from '../../Experience.js';

const POD = 4;
const DURATION = 15;
const COOLDOWN = 110;
const BOOST_NEEDED = 3.2;

/**
 * A dolphin pod that joins the boat under full sail, leaping alongside for a
 * while before peeling away. Procedural bodies, no assets.
 */
export default class Dolphins {
    constructor(events) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.time = this.experience.time;
        this.events = events;
        this.ocean = events.ocean;

        this.active = false;
        this.t = 0;
        this.boostTime = 0;
        this.cooldownUntil = 40;
        this.nextChirp = 0;

        this.group = new THREE.Group();
        this.group.name = 'dolphins';
        this.group.visible = false;
        this.scene.add(this.group);

        this.material = new THREE.MeshStandardMaterial({ color: 0x86A7B8, roughness: 0.4, metalness: 0.05 });
        this.bellyMat = new THREE.MeshStandardMaterial({ color: 0xE3ECF0, roughness: 0.6 });
        this.pod = [];
        for (let i = 0; i < POD; i++) this.pod.push(this.makeDolphin(i));

        this._p = new THREE.Vector3();
        this._right = new THREE.Vector3();
    }

    makeDolphin(i) {
        const body = new THREE.Group();
        const torso = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), this.material);
        torso.scale.set(1, 0.85, 2.9);
        torso.castShadow = true;
        body.add(torso);

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.bellyMat);
        belly.scale.set(1, 0.6, 2.4);
        belly.position.y = -0.1;
        body.add(belly);

        const snout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 10), this.material);
        snout.rotation.x = -Math.PI / 2;
        snout.position.set(0, -0.02, -0.98);
        body.add(snout);

        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 4), this.material);
        fin.position.set(0, 0.36, 0.05);
        fin.rotation.x = 0.55;
        fin.scale.set(0.5, 1, 1.4);
        body.add(fin);

        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.28), this.material);
        tail.position.set(0, 0, 0.95);
        body.add(tail);

        for (const side of [-1, 1]) {
            const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), this.material);
            flipper.position.set(side * 0.3, -0.12, -0.2);
            flipper.rotation.z = side * 0.45;
            body.add(flipper);
        }

        this.group.add(body);
        const side = i % 2 === 0 ? -1 : 1;
        return {
            body,
            tail,
            side,
            lat: 3.2 + Math.floor(i / 2) * 1.5,
            lon: -1.2 + Math.floor(i / 2) * 2.0 + (i % 2) * 0.7,
            phase: i * 1.35,
            rate: 2.1 + (i % 3) * 0.15,
            ax: 0, az: 0,
            wasAir: false,
        };
    }

    start() {
        const boat = this.experience.world.boat;
        const p = boat.getPosition();
        this.active = true;
        this.t = 0;
        this.group.visible = true;
        for (const d of this.pod) {
            // Start a little behind and beside so they visibly catch up
            const right = this._right.set(boat.forward.z, 0, -boat.forward.x);
            d.ax = p.x + right.x * d.side * (d.lat + 4) - boat.forward.x * 6;
            d.az = p.z + right.z * d.side * (d.lat + 4) - boat.forward.z * 6;
        }
        const progress = this.experience.progress;
        const first = progress.addSecret('dolphins');
        const ui = this.experience.world.ui;
        if (first && ui) ui.toast('A DOLPHIN POD JOINS THE BOAT', 3000);
        this.experience.emit('event:dolphins');
        this.nextChirp = 1.2;
    }

    stop() {
        this.active = false;
        this.group.visible = false;
        this.cooldownUntil = this.events.clock + COOLDOWN;
    }

    update(dt) {
        const world = this.experience.world;
        const boat = world.boat;
        const controls = this.experience.controls;
        if (!boat || !boat.rigidBody) return;

        // Trigger: sustained full sail on open water, no squall at its height
        if (!this.active) {
            // Boost tops out near 6.3 once damping balances thrust; plain sail near 4
            const boosting = controls.keys.boost && boat.forwardSpeed > 5.2;
            this.boostTime = boosting ? this.boostTime + dt : 0;
            const calm = !world.weather || world.weather.intensity < 0.5;
            if (this.boostTime > BOOST_NEEDED && calm && this.events.clock > this.cooldownUntil && !controls.locked) this.start();
            return;
        }

        this.t += dt;
        const p = boat.getPosition();
        const fwd = boat.forward;
        const right = this._right.set(fwd.z, 0, -fwd.x);
        const tSec = this.time.elapsed / 1000;
        const leaving = this.t > DURATION - 4;
        const gone = leaving ? THREE.MathUtils.smoothstep((this.t - (DURATION - 4)) / 4, 0, 1) : 0;

        if (this.t > this.nextChirp) {
            this.nextChirp = this.t + 2.5 + Math.random() * 4;
            const d = this.pod[Math.floor(Math.random() * this.pod.length)];
            const audio = this.experience.audio;
            if (audio) audio.playAt('dolphin', d.body.position.x, d.body.position.z, { maxDist: 40 });
        }

        for (const d of this.pod) {
            const lat = d.lat + gone * 14;
            const tx = p.x + right.x * d.side * lat + fwd.x * d.lon;
            const tz = p.z + right.z * d.side * lat + fwd.z * d.lon;
            // Follow with a lag so the pod swims rather than sticks
            const k = Math.min(1, dt * 2.2);
            d.ax += (tx - d.ax) * k;
            d.az += (tz - d.az) * k;

            const ph = tSec * d.rate + d.phase;
            const s = Math.sin(ph);
            const water = this.ocean.getHeight(d.ax, d.az);
            const air = s > 0;
            const arc = air ? s * 2.4 : s * 0.9;
            const y = water + arc - 0.35 - gone * 2.5;
            d.body.position.set(d.ax, y, d.az);

            // Face travel direction, pitch along the arc
            d.body.rotation.y = Math.atan2(fwd.x, fwd.z) + Math.PI;
            d.body.rotation.x = air ? -Math.cos(ph) * 0.85 : -Math.cos(ph) * 0.25;
            d.body.rotation.z = d.side * 0.08 * s;
            d.tail.rotation.x = Math.sin(tSec * 9 + d.phase) * (air ? 0.15 : 0.5);
            d.body.visible = y > water - 1.6;

            // Splash on entry and exit
            if (air !== d.wasAir && gone < 0.5) {
                const vy = air ? 3.2 : 2.4;
                this.events.splash.burst(d.ax, water + 0.1, d.az, fwd.x * 2, vy, fwd.z * 2, { n: air ? 5 : 9, spread: 1.6, size: 0.5, life: 0.7 });
                this.events.wake.emit(d.ax, d.az, { size: 1.4, life: 1.2, jitter: 0.4 });
            }
            d.wasAir = air;
        }

        if (this.t > DURATION) this.stop();
    }
}
