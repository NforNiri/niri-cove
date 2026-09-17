import * as THREE from 'three';
import gsap from 'gsap';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Experience from '../Experience.js';
import { ISLANDS } from '../World/layout.js';
import { DOUBLOON_TOTAL } from '../Utils/Progress.js';

const IDLE_QUIP_EVERY = [50, 95];

/**
 * Biscuit, the ship's parrot. Perches on the stern rail, watches the camera,
 * flaps under full sail, and talks: onboarding hints route through his speech
 * bubble, and between hints he drops context-aware quips.
 */
export default class Parrot {
    constructor(boatVisual) {
        this.experience = Experience.getInstance();
        this.time = this.experience.time;
        this.boatVisual = boatVisual;
        this.name = 'Biscuit';

        this.group = new THREE.Group();
        this.group.name = 'parrot';
        const perch = boatVisual.rig ? boatVisual.rig.perch : new THREE.Vector3(0.76, 1.68, 1.8);
        this.group.position.copy(perch);
        this.perchY = perch.y;
        boatVisual.pivot.add(this.group);
        this._q = new THREE.Quaternion();

        this.build();
        this.buildBubble();

        this.sticky = null;
        this.quipUntil = 0;
        this.nextQuip = 28;
        this.clock = 0;
        this.said = new Set();
        this.idleSince = 0;
        this.headTarget = 0;
        this.blink = 0;

        this._v = new THREE.Vector3();
        this._w = new THREE.Vector3();

        this.experience.on('intro:done', () => { this.active = true; });
        this.experience.on('weather:squall', () => this.say('Squall! Reef nothing, we have no reef. Hold her steady!', { hold: 4200, squawk: true }));
        this.experience.on('weather:clear', () => this.say('Rainbow off the bow. Told ye it would pass.', { hold: 3600 }));
        this.experience.on('progress:unlock', (r) => {
            if (r.id === 'gull') this.say('A gull? Fine. I am still the ship\'s bird.', { hold: 3800, squawk: true });
        });
        this.experience.on('event:dolphins', () => this.say('Dolphins! Show-offs. Keep the sail full.', { hold: 3600, squawk: true }));
        this.experience.on('event:kraken', () => { if (!this.experience.progress.hasSecret('kraken')) this.say('Did ye feel that? Something moved out east...', { hold: 4600 }); });

        this.experience.addUpdate(7, () => this.update());
    }

    // ── Body ─────────────────────────────────────────────────────────────

    build() {
        const red = new THREE.MeshStandardMaterial({ color: 0xD8382E, roughness: 0.7 });
        const blue = new THREE.MeshStandardMaterial({ color: 0x2A5DB0, roughness: 0.7 });
        const yellow = new THREE.MeshStandardMaterial({ color: 0xF2B234, roughness: 0.7 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x2B2B2B, roughness: 0.5 });
        const white = new THREE.MeshStandardMaterial({ color: 0xF6F1E6, roughness: 0.8 });

        this.body = new THREE.Group();
        this.group.add(this.body);

        const torso = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), red);
        torso.scale.set(1, 1.3, 1.05);
        torso.castShadow = true;
        this.body.add(torso);

        this.head = new THREE.Group();
        this.head.position.set(0, 0.2, 0.02);
        this.body.add(this.head);
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), red);
        this.head.add(skull);
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), white);
        cheek.scale.set(1, 0.9, 0.6);
        cheek.position.set(0, -0.01, -0.06);
        this.head.add(cheek);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), dark);
        beak.rotation.x = -Math.PI / 2 - 0.5;
        beak.position.set(0, -0.02, -0.1);
        this.head.add(beak);
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), dark);
            eye.position.set(side * 0.05, 0.02, -0.055);
            this.head.add(eye);
        }
        this.eyes = this.head.children.slice(-2);

        this.wings = [];
        for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.1, 0.06, 0);
            const wing = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), blue);
            wing.scale.set(0.28, 1.1, 0.7);
            wing.position.set(side * 0.03, -0.06, 0.01);
            pivot.add(wing);
            this.body.add(pivot);
            this.wings.push({ pivot, side });
        }

        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.26), blue);
        tail.position.set(0, -0.12, 0.2);
        tail.rotation.x = -0.5;
        this.body.add(tail);
        const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.2), yellow);
        tail2.position.set(0, -0.11, 0.22);
        tail2.rotation.x = -0.5;
        this.body.add(tail2);

        // Feet on the rail
        for (const side of [-1, 1]) {
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.06), dark);
            foot.position.set(side * 0.04, -0.17, -0.01);
            this.body.add(foot);
        }
        // Face forward-ish (toward the bow is -Z); a parrot on the stern watches ahead
        this.body.rotation.y = 0;
    }

    buildBubble() {
        // CSS2DRenderer owns the anchor's transform; GSAP animates the inner bubble
        const anchor = document.createElement('div');
        anchor.className = 'parrot-anchor';
        this.bubbleEl = document.createElement('div');
        this.bubbleEl.className = 'parrot-bubble parchment';
        this.bubbleEl.innerHTML = `<span class="parrot-name">${this.name}</span><span class="parrot-text"></span>`;
        anchor.appendChild(this.bubbleEl);
        this.bubble = new CSS2DObject(anchor);
        this.bubble.position.set(0, 0.42, 0);
        this.group.add(this.bubble);
        gsap.set(this.bubbleEl, { opacity: 0, scale: 0.85 });
        this.bubbleShown = false;
    }

    // ── Speech ───────────────────────────────────────────────────────────

    /**
     * Show a line. `sticky` lines stay until `clear()`; others hold for `hold` ms.
     * Onboarding hints pass raw HTML (with <kbd> keys).
     */
    say(text, { hold = 3500, sticky = false, html = false, squawk = false } = {}) {
        if (sticky) this.sticky = text;
        else if (this.sticky) return false; // a hint is on screen; do not talk over it
        const el = this.bubbleEl.querySelector('.parrot-text');
        if (html) el.innerHTML = text;
        else el.textContent = text;
        this.quipUntil = sticky ? Infinity : this.clock + hold / 1000;
        this.showBubble();
        if (squawk) {
            const audio = this.experience.audio;
            if (audio) audio.playSFX('parrot');
        }
        // A little hop
        gsap.killTweensOf(this.body.position);
        gsap.fromTo(this.body.position, { y: 0 }, { y: 0.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.out' });
        return true;
    }

    /** Called by Hints when a hint is satisfied. */
    clear() {
        this.sticky = null;
        this.quipUntil = 0;
        this.hideBubble();
    }

    showBubble() {
        gsap.killTweensOf(this.bubbleEl);
        gsap.to(this.bubbleEl, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.8)' });
        this.bubbleShown = true;
    }

    hideBubble() {
        if (!this.bubbleShown) return;
        gsap.killTweensOf(this.bubbleEl);
        gsap.to(this.bubbleEl, { opacity: 0, scale: 0.85, duration: 0.25, ease: 'power2.in' });
        this.bubbleShown = false;
    }

    once(id, text, opts) {
        if (this.said.has(id)) return false;
        const ok = this.say(text, opts);
        if (ok) this.said.add(id);
        return ok;
    }

    /** Pick something relevant to say right now. */
    quip() {
        const exp = this.experience;
        const world = exp.world;
        const boat = world.boat;
        const progress = exp.progress;
        const env = world.environment;
        const night = env && env.nightFactor > 0.6;
        const p = boat.getPosition();

        if (progress.returning && this.once('back', 'Back again? The sea missed ye. Mostly the sea.', { squawk: true })) return;
        if (night && !progress.hasQuest('projector') && this.once('projector', 'Lanterns are lit. Lantern Bay screens a reel after dark, ye know.')) return;
        if (night && !progress.hasSecret('kraken') && Math.random() < 0.5 && this.once('kraken-hint', 'Old salts say something stirs far past the east shoal after dark. Not that I believe them.')) return;

        // Nearest doubloon still out there
        const floaters = world.floaters;
        if (floaters) {
            let best = null, bd = Infinity;
            for (const c of floaters.coins) {
                if (c.collected) continue;
                const d = Math.hypot(c.group.position.x - p.x, c.group.position.z - p.z);
                if (d < bd) { bd = d; best = c; }
            }
            if (best && bd < 14 && bd > 3 && this.say('Shiny! Doubloon close by, keep yer eyes on the water.', { squawk: true })) return;
        }

        if (this.idleSince > 25 && this.say(Math.random() < 0.5 ? 'Are we anchored, or just thinking?' : 'Fine view. Finer if we moved, mind.', {})) return;
        if (progress.islandsVisited >= ISLANDS.length && progress.doubloons < DOUBLOON_TOTAL && this.once('all-islands', `Every island charted. Now, about those ${DOUBLOON_TOTAL - progress.doubloons} doubloons...`)) return;
        if (!progress.hasVisited('work') && this.once('work', 'The Shipyard is where the real work is. Cannon too. I like the cannon.')) return;
        if (!progress.hasVisited('resume') && this.once('resume', 'Treasure Rock has an X on it. Ye know what to do with an X.')) return;

        const generic = [
            'Pieces of eight! ...just kidding, we use doubloons here.',
            'I would lend a hand but I have only got wings.',
            'Full sail is Shift. Not nagging. Squawking.',
            'The main site is on the Chart menu. Captain asked me to mention it.',
            'Press C for the chart. Or tap the little map. I am flexible.',
            'A merchant runs these waters. Sail up close and she will salute.',
            'Bottles wash through the lagoon now and then. The notes are worth a read.',
        ];
        const pool = generic.filter((g) => !this.said.has(g));
        if (!pool.length) return;
        const line = pool[Math.floor(Math.random() * pool.length)];
        if (this.say(line, {})) this.said.add(line);
    }

    // ── Loop ─────────────────────────────────────────────────────────────

    update() {
        const dt = Math.min(this.time.delta / 1000, 0.1);
        const t = this.time.elapsed / 1000;
        const world = this.experience.world;
        const boat = world ? world.boat : null;
        if (!boat || !boat.rigidBody) return;

        // Idle bob and breathing (gsap owns the hop on body.position)
        this.group.position.y = this.perchY + Math.sin(t * 2.1) * 0.006;
        this.body.scale.y = 1 + Math.sin(t * 3.4) * 0.02;

        // Head turns toward the camera now and then, otherwise scans about
        const cam = this.experience.camera ? this.experience.camera.instance : null;
        if (cam) {
            this.group.getWorldPosition(this._w);
            this._v.copy(cam.position).sub(this._w);
            this._v.applyQuaternion(this.group.getWorldQuaternion(this._q).invert());
            const toCam = Math.atan2(this._v.x, -this._v.z);
            const look = Math.sin(t * 0.37) > 0.3 ? toCam : Math.sin(t * 0.9) * 0.5;
            this.headTarget = THREE.MathUtils.clamp(look, -1.4, 1.4);
        }
        this.head.rotation.y += (this.headTarget - this.head.rotation.y) * Math.min(1, dt * 6);
        this.head.rotation.z = Math.sin(t * 1.7) * 0.06;

        // Blink
        this.blink -= dt;
        if (this.blink < 0) {
            this.blink = 2 + Math.random() * 4;
            for (const e of this.eyes) gsap.fromTo(e.scale, { y: 1 }, { y: 0.1, duration: 0.07, yoyo: true, repeat: 1 });
        }

        // Wings: tucked at rest, flapping under full sail and in gusts
        const controls = this.experience.controls;
        const boosting = controls.keys.boost && boat.forwardSpeed > 5;
        const gust = world.weather ? world.weather.wind : 0;
        const flap = boosting ? Math.abs(Math.sin(t * 14)) * 0.9 : gust * 0.3 + Math.max(0, Math.sin(t * 0.8)) * 0.05;
        for (const w of this.wings) w.pivot.rotation.z = w.side * -flap;

        if (!this.active) return;
        this.clock += dt;
        this.idleSince = boat.speed < 0.4 ? this.idleSince + dt : 0;

        // Bubble lifetime
        if (this.bubbleShown && !this.sticky && this.clock > this.quipUntil) this.hideBubble();

        // Idle quips only when nothing else is on screen
        const panelOpen = document.body.classList.contains('panel-open') || document.body.classList.contains('menu-open') || document.body.classList.contains('chart-open') || document.body.classList.contains('bottle-open');
        if (!this.sticky && !this.bubbleShown && !panelOpen && this.clock > this.nextQuip) {
            this.nextQuip = this.clock + IDLE_QUIP_EVERY[0] + Math.random() * (IDLE_QUIP_EVERY[1] - IDLE_QUIP_EVERY[0]);
            this.quip();
        }
    }
}
