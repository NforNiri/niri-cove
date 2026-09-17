import * as THREE from 'three';
import gsap from 'gsap';
import Experience from '../../Experience.js';
import { cloneModel, fitFootprint } from '../../Utils/models.js';
import { SPAWN, shoreDistance } from '../layout.js';

const FIRST_AFTER_S = 55;
const NEXT_AFTER_S = [150, 240];

// Notes that wash ashore. Short, true, a little playful.
export const NOTES = [
    { title: 'Ship\'s papers', text: 'The captain is a Bezalel Academy of Art and Design graduate who ended up running budgets, briefs and AI pipelines. Creative direction with a delivery spine.' },
    { title: 'Ten years at the helm', text: '10+ years of end-to-end ownership: brief, scope, production, QA, launch. Eighty-odd voyages delivered and counting.' },
    { title: 'How the sea works', text: 'Every wave you ride is four Gerstner waves. The same function runs on the GPU for the surface and on the CPU for the hull, so the boat floats on exactly what you see.' },
    { title: 'Twenty doubloons', text: 'Six of the twenty doubloons hide behind the sandbars and by the old wreck west of Treasure Rock. The chart hints at the nearest.' },
    { title: 'After dark', text: 'Lantern Bay only screens its reel after sunset, and the lighthouse beam swings out to sea. Some things surface only at night.' },
    { title: 'A faster tide', text: 'Press H to switch between Fine and Swift quality. Swift drops reflections and rain but keeps the same sea.' },
    { title: 'The main harbour', text: 'The full portfolio, case studies and resume live at niri-portfolio.vercel.app. This cove is the scenic route.', link: 'https://niri-portfolio.vercel.app/' },
    { title: 'Crew list', text: 'Built with Three.js, Rapier physics, GLSL, GSAP and Howler. Every sound, including this bottle, was synthesised in code.' },
    { title: 'Old salts say', text: 'Something large stirs far past the east shoal after dark. Nobody who sailed out to look has said much since.' },
    { title: 'Biscuit', text: 'The parrot on the stern rail is named Biscuit. She repeats whatever the captain says, then takes credit for it.' },
];

/**
 * A drifting message in a bottle. One at a time, somewhere on the lagoon;
 * sail up, press E, read the note. Then the sea sends another later.
 */
export default class Bottle {
    constructor(events) {
        this.experience = Experience.getInstance();
        this.scene = this.experience.scene;
        this.resources = this.experience.resources;
        this.time = this.experience.time;
        this.events = events;
        this.ocean = events.ocean;

        this.group = null;
        this.entry = null;
        this.nextAt = FIRST_AFTER_S;
        this.noteIndex = 0;
        this.shuffle = NOTES.map((_, i) => i).sort(() => Math.random() - 0.5);
        this.drift = new THREE.Vector2(0.18, 0.07);

        this.createCard();
    }

    // ── World object ─────────────────────────────────────────────────────

    findSpot() {
        const boat = this.experience.world.boat;
        const bp = boat ? boat.getPosition() : SPAWN;
        for (let i = 0; i < 20; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 8 + Math.random() * 20;
            const x = SPAWN.x + Math.cos(a) * r;
            const z = SPAWN.z + Math.sin(a) * r;
            const toBoat = Math.hypot(x - bp.x, z - bp.z);
            if (shoreDistance(x, z) > 7 && toBoat > 14) return { x, z };
        }
        return { x: SPAWN.x + 10, z: SPAWN.z + 6 };
    }

    spawn() {
        const spot = this.findSpot();
        const group = new THREE.Group();
        group.position.set(spot.x, 0, spot.z);

        const model = cloneModel(this.resources, 'bottle-large') || cloneModel(this.resources, 'bottle');
        if (model) {
            fitFootprint(model, 0.9, -0.1);
            model.rotation.z = Math.PI * 0.42; // lying on its side
            model.rotation.y = Math.random() * Math.PI;
            group.add(model);
        } else {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x8FBFA8, transparent: true, opacity: 0.8 }));
            m.rotation.z = Math.PI * 0.42;
            group.add(m);
        }

        // Glass glint ring so it reads from a distance
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.6, 0.78, 24),
            new THREE.MeshBasicMaterial({ color: 0xB9F1DC, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.2;
        group.add(ring);

        this.scene.add(group);
        this.group = group;
        this.ring = ring;
        this.phase = Math.random() * 6;

        const interactables = this.experience.world.interactables;
        if (interactables) {
            this.entry = interactables.add({
                id: 'bottle',
                x: spot.x, z: spot.z,
                radius: 4.5,
                quest: false,
                label: 'Open the bottle',
                action: () => this.open(),
            });
        }
    }

    despawn() {
        if (this.entry && this.experience.world.interactables) this.experience.world.interactables.remove(this.entry);
        this.entry = null;
        if (this.group) this.scene.remove(this.group);
        this.group = null;
    }

    async open() {
        if (!this.group) return;
        const audio = this.experience.audio;
        if (audio) audio.playSFX('bottle');
        const g = this.group;
        gsap.to(g.position, { y: g.position.y + 1.6, duration: 0.5, ease: 'power2.out' });
        gsap.to(g.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, delay: 0.15, ease: 'power2.in' });

        const note = NOTES[this.shuffle[this.noteIndex % this.shuffle.length]];
        this.noteIndex++;
        const first = this.experience.progress.addSecret('bottle');
        this.experience.emit('event:bottle', note.title);

        await new Promise((r) => setTimeout(r, 450));
        this.despawn();
        this.nextAt = this.events.clock + NEXT_AFTER_S[0] + Math.random() * (NEXT_AFTER_S[1] - NEXT_AFTER_S[0]);
        this.showCard(note, first);
    }

    // ── Note card ────────────────────────────────────────────────────────

    createCard() {
        this.card = document.createElement('div');
        this.card.id = 'bottle-card';
        this.card.innerHTML = `
            <div class="bottle-backdrop"></div>
            <div class="bottle-note parchment" role="dialog" aria-label="Message in a bottle">
                <p class="bottle-eyebrow">A note in a bottle</p>
                <h3 class="bottle-title"></h3>
                <p class="bottle-text"></p>
                <a class="bottle-link" target="_blank" rel="noopener" hidden></a>
                <p class="bottle-foot"></p>
                <button class="bottle-close" type="button">Back to the tiller</button>
            </div>`;
        this.card.style.display = 'none';
        document.body.appendChild(this.card);
        const close = () => this.hideCard();
        this.card.querySelector('.bottle-backdrop').addEventListener('click', close);
        this.card.querySelector('.bottle-close').addEventListener('click', close);
        window.addEventListener('keydown', (e) => {
            if (this.card.style.display !== 'none' && (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Enter')) {
                e.stopPropagation();
                close();
            }
        }, true);
    }

    showCard(note, first) {
        this.card.querySelector('.bottle-title').textContent = note.title;
        this.card.querySelector('.bottle-text').textContent = note.text;
        const link = this.card.querySelector('.bottle-link');
        if (note.link) { link.hidden = false; link.href = note.link; link.textContent = note.link.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' →'; }
        else link.hidden = true;
        this.card.querySelector('.bottle-foot').textContent = first ? 'First bottle found — logged in the Captain\'s Log.' : `Note ${this.noteIndex} of ${NOTES.length}. The sea will send another.`;
        this.card.style.display = 'flex';
        document.body.classList.add('bottle-open');
        const note$ = this.card.querySelector('.bottle-note');
        gsap.fromTo(this.card, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        gsap.fromTo(note$, { y: 30, rotation: -3, scale: 0.94 }, { y: 0, rotation: 0, scale: 1, duration: 0.55, ease: 'back.out(1.6)' });
        const audio = this.experience.audio;
        if (audio) audio.playPanelOpen();
    }

    hideCard() {
        gsap.to(this.card, { opacity: 0, duration: 0.25, onComplete: () => { this.card.style.display = 'none'; } });
        document.body.classList.remove('bottle-open');
    }

    // ── Loop ─────────────────────────────────────────────────────────────

    update(dt) {
        if (!this.group) {
            if (this.events.clock > this.nextAt && !this.experience.controls.locked) this.spawn();
            return;
        }
        const t = this.time.elapsed / 1000;
        const g = this.group;
        // Drift with a slow meander; stay off the sand
        const weather = this.experience.world.weather;
        const gust = weather ? weather.wind : 0;
        const dx = (this.drift.x + Math.sin(t * 0.15 + this.phase) * 0.12) * (1 + gust * 1.5) * dt;
        const dz = (this.drift.y + Math.cos(t * 0.11 + this.phase) * 0.12) * (1 + gust * 1.5) * dt;
        if (shoreDistance(g.position.x + dx, g.position.z + dz) > 5) {
            g.position.x += dx;
            g.position.z += dz;
        } else {
            this.drift.multiplyScalar(-1);
        }
        const h = this.ocean.getHeight(g.position.x, g.position.z);
        g.position.y = h + 0.12 + Math.sin(t * 1.7 + this.phase) * 0.06;
        g.rotation.y = Math.sin(t * 0.4 + this.phase) * 0.6;
        g.rotation.x = Math.sin(t * 1.3 + this.phase) * 0.12;
        this.ring.material.opacity = 0.22 + Math.sin(t * 2.4 + this.phase) * 0.12;

        if (this.entry) { this.entry.x = g.position.x; this.entry.z = g.position.z; }
    }
}
