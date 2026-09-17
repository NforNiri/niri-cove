import { Howl, Howler } from 'howler';
import * as THREE from 'three';
import Experience from './Experience.js';

const PREF_KEY = 'cove.audio';

/**
 * Sound design for the cove.
 *
 * Music bucket: ocean ambience + two music stems (day / night) crossfaded by the
 * Environment clock. SFX bucket: hull creak + wake wash driven by speed, one-shots
 * (sail snap, anchor splash, bell, coin, UI), and positional island loops
 * (campfire crackle, gull cries, projector) panned and attenuated by distance.
 *
 * Audio is ON by default once the Set Sail gesture unlocks the context; the
 * preference is remembered in localStorage and there is a visible mute chip.
 */
export default class Audio {
    constructor() {
        this.experience = Experience.getInstance();
        this.time = this.experience.time;

        const pref = this.loadPref();
        this.musicMuted = pref.music;
        this.sfxMuted = pref.sfx;
        this.started = false;
        this.sounds = {};
        this.emitters = [];
        this.night = 0;

        this._right = new THREE.Vector3();
        this._fwd = new THREE.Vector3();
        this._to = new THREE.Vector3();

        this.createSounds();
        this.createChip();
    }

    loadPref() {
        try {
            const raw = localStorage.getItem(PREF_KEY);
            if (raw) {
                const p = JSON.parse(raw);
                return { music: !!p.music, sfx: !!p.sfx };
            }
        } catch (e) { /* private mode */ }
        return { music: false, sfx: false };
    }

    savePref() {
        try {
            localStorage.setItem(PREF_KEY, JSON.stringify({ music: this.musicMuted, sfx: this.sfxMuted }));
        } catch (e) { /* ignore */ }
    }

    createSounds() {
        // Procedurally generated (CC0) sounds: WAV sources in assets-src/sounds,
        // encoded to OGG + MP3 in /static/sounds by scripts/compress-sounds.mjs.
        // `lazy` sounds are fetched on first play (Howler queues the play).
        const lazy = { preload: false };

        // Heard in the first minute: preload
        this.sounds.ambient = this.createHowl('ocean-ambience', { loop: true, volume: 0.22 });
        this.sounds.musicDay = this.createHowl('music-day', { loop: true, volume: 0 });
        this.sounds.hullCreak = this.createHowl('hull-creak', { loop: true, volume: 0 });
        this.sounds.wake = this.createHowl('wake-wash', { loop: true, volume: 0 });
        this.sounds.sail = this.createHowl('sail-snap', { volume: 0.45 });
        this.sounds.anchor = this.createHowl('anchor-splash', { volume: 0.4 });
        this.sounds.bell = this.createHowl('ship-bell', { volume: 0.4 });
        this.sounds.coin = this.createHowl('coin', { volume: 0.4 });
        this.sounds.uiClick = this.createHowl('wood-click', { volume: 0.3 });
        this.sounds.panelOpen = this.createHowl('parchment', { volume: 0.35 });
        this.sounds.parrot = this.createHowl('parrot', { volume: 0.28 });
        this.sounds.gull = this.createHowl('gull', { volume: 0.3 });
        this.sounds.splash = this.createHowl('splash', { volume: 0.4 });

        // Night bed: the cycle is 14 min, so it is never needed at launch
        this.sounds.musicNight = this.createHowl('music-night', { loop: true, volume: 0, ...lazy });

        // Quest / event one-shots
        this.sounds.cannon = this.createHowl('cannon', { volume: 0.55, ...lazy });
        this.sounds.dig = this.createHowl('dig', { volume: 0.45, ...lazy });
        this.sounds.chest = this.createHowl('chest-open', { volume: 0.45, ...lazy });
        this.sounds.quest = this.createHowl('quest', { volume: 0.45, ...lazy });

        // Positional loops (volume set per frame from distance)
        this.sounds.campfire = this.createHowl('campfire', { loop: true, volume: 0, ...lazy });
        this.sounds.projector = this.createHowl('projector', { loop: true, volume: 0, ...lazy });

        // Weather + living world
        this.sounds.rain = this.createHowl('rain', { loop: true, volume: 0, ...lazy });
        this.sounds.thunder = this.createHowl('thunder', { volume: 0.55, ...lazy });
        this.sounds.dolphin = this.createHowl('dolphin', { volume: 0.35, ...lazy });
        this.sounds.whale = this.createHowl('whale', { volume: 0.5, ...lazy });
        this.sounds.bottle = this.createHowl('bottle', { volume: 0.45, ...lazy });
        this.sounds.kraken = this.createHowl('kraken', { volume: 0.6, ...lazy });
        this.sounds.horn = this.createHowl('horn', { volume: 0.4, ...lazy });
        this.rainLevel = 0;
    }

    createHowl(name, options = {}) {
        try {
            return new Howl({
                // Howler plays the first format the browser supports
                src: [`/sounds/${name}.ogg`, `/sounds/${name}.mp3`],
                ...options,
                onloaderror: () => console.warn(`Audio not found: ${name} — skipping`)
            });
        } catch (e) {
            return null;
        }
    }

    /**
     * Start a Howl, fetching it first if it was created lazily. Howler queues
     * the play until the load completes, so callers can treat this as play().
     * Returns the sound id (or null while a previous load is still pending).
     */
    startLazy(s) {
        if (!s) return null;
        const state = s.state();
        if (state === 'loading') return null;
        if (state === 'unloaded') s.load();
        return s.play();
    }

    // ── HUD chip ─────────────────────────────────────────────────────────

    createChip() {
        this.chip = document.createElement('button');
        this.chip.id = 'audio-chip';
        this.chip.className = 'hud-chip';
        this.chip.title = 'Mute / unmute (M)';
        this.chip.setAttribute('aria-label', 'Toggle sound');
        this.chip.addEventListener('click', () => this.toggleMute());
        document.body.appendChild(this.chip);
        this.updateChip();
    }

    updateChip() {
        const muted = this.musicMuted && this.sfxMuted;
        this.chip.classList.toggle('is-muted', muted);
        this.chip.innerHTML = muted
            ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg><span>Sound off</span>`
            : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg><span>Sound on</span>`;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    start() {
        if (this.started) return;
        this.started = true;

        for (const key of ['ambient', 'musicDay', 'musicNight']) {
            const s = this.sounds[key];
            if (!s) continue;
            s.mute(this.musicMuted);
            // The night stem is lazy: fetched and started the first time dusk mixes it in
            if (key !== 'musicNight') s.play();
        }
        for (const key of ['hullCreak', 'wake', 'campfire', 'projector', 'rain']) {
            const s = this.sounds[key];
            if (!s) continue;
            s.mute(this.sfxMuted);
            // Positional loops start when first heard (see update/emitters)
            if (key === 'hullCreak' || key === 'wake') s.play();
        }
        this.applyMusicMix();
    }

    /** Weather: start/stop the rain loop; level (0..1) sets its volume per frame. */
    setRain(on) {
        const s = this.sounds.rain;
        if (!s || !this.started) return;
        if (on && !s.playing()) { s.volume(0); this.startLazy(s); }
        if (!on && s.playing()) {
            s.fade(s.volume(), 0, 1500);
            s.once('fade', () => { if (this.rainLevel < 0.01) s.stop(); });
        }
    }

    setRainLevel(level) {
        this.rainLevel = level;
        const s = this.sounds.rain;
        if (!s || !this.started || this.sfxMuted || !s.playing()) return;
        if (level > 0.01) s.volume(Math.min(0.5, level * 0.5));
    }

    /** Register a world-space loop; volume/pan follow the camera every frame. */
    addEmitter({ key, x, z, maxDist = 30, volume = 0.5, enabled = true }) {
        const emitter = { key, x, z, maxDist, volume, enabled };
        this.emitters.push(emitter);
        return emitter;
    }

    /** One-shot at a world position (gull cry, distant bell). */
    playAt(key, x, z, { maxDist = 60, volume = 1 } = {}) {
        if (!this.started || this.sfxMuted) return;
        const s = this.sounds[key];
        if (!s) return;
        const { gain, pan } = this.spatialize(x, z, maxDist);
        if (gain < 0.02) return;
        const id = this.startLazy(s);
        if (id === null) return;
        s.volume(gain * volume * this.baseVolume(key), id);
        s.stereo(pan, id);
    }

    baseVolume(key) {
        const base = { gull: 0.3, bell: 0.4, splash: 0.4, cannon: 0.55, dolphin: 0.35, whale: 0.5, kraken: 0.6, horn: 0.4, parrot: 0.28, bottle: 0.45 };
        return base[key] ?? 0.4;
    }

    spatialize(x, z, maxDist) {
        const cam = this.experience.camera ? this.experience.camera.instance : null;
        if (!cam) return { gain: 1, pan: 0 };
        const dx = x - cam.position.x;
        const dz = z - cam.position.z;
        const dist = Math.hypot(dx, dz);
        const gain = Math.pow(THREE.MathUtils.clamp(1 - dist / maxDist, 0, 1), 1.6);
        this._fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
        this._fwd.y = 0;
        this._fwd.normalize();
        this._right.set(-this._fwd.z, 0, this._fwd.x);
        const pan = dist > 0.01 ? THREE.MathUtils.clamp((dx * this._right.x + dz * this._right.z) / dist * 0.8, -1, 1) : 0;
        return { gain, pan };
    }

    /**
     * @param {number} speed horizontal hull speed (world units / s)
     * @param {boolean} isBoosting
     */
    update(speed, isBoosting) {
        if (!this.started) return;

        const env = this.experience.world ? this.experience.world.environment : null;
        const night = env ? env.nightFactor : 0;
        if (Math.abs(night - this.night) > 0.005) {
            this.night = night;
            this.applyMusicMix();
        }

        if (this.sfxMuted) return;

        const maxSpeed = isBoosting ? 11 : 7;
        const ratio = Math.min(speed / maxSpeed, 1);

        if (this.sounds.hullCreak) {
            this.sounds.hullCreak.volume(0.08 + ratio * 0.08);
        }
        if (this.sounds.wake) {
            this.sounds.wake.volume(Math.min(0.45, ratio * 0.5));
            this.sounds.wake.rate(0.85 + ratio * 0.35);
        }

        for (const e of this.emitters) {
            const s = this.sounds[e.key];
            if (!s) continue;
            if (!e.enabled) { s.volume(0); continue; }
            const { gain, pan } = this.spatialize(e.x, e.z, e.maxDist);
            s.volume(gain * e.volume);
            s.stereo(pan);
            // Lazy loops: fetch + start the first time they are within earshot
            if (gain > 0.01 && !s.playing()) this.startLazy(s);
        }
    }

    applyMusicMix() {
        const day = this.sounds.musicDay;
        const nightStem = this.sounds.musicNight;
        // Equal-power crossfade, kept under the ambience so it never nags
        const n = THREE.MathUtils.clamp(this.night, 0, 1);
        const duck = this.ducked ? 0.12 : 1;
        if (day) day.volume(Math.cos(n * Math.PI / 2) * 0.28 * duck);
        if (nightStem) {
            nightStem.volume(Math.sin(n * Math.PI / 2) * 0.3 * duck);
            // Lazy stem: fetch and start it as dusk begins to mix it in
            if (this.started && n > 0.01 && !nightStem.playing()) this.startLazy(nightStem);
        }
        if (this.sounds.ambient) this.sounds.ambient.volume(0.22 * (this.ducked ? 0.4 : 1));
    }

    /** Pull the music and sea down while a video plays in the lightbox. */
    duckMusic(on) {
        this.ducked = !!on;
        if (this.started) this.applyMusicMix();
    }

    // ── One-shots ────────────────────────────────────────────────────────

    playSFX(key) {
        if (!this.started || this.sfxMuted) return;
        this.startLazy(this.sounds[key]);
    }

    playBoost()     { this.playSFX('sail'); }
    playBrake()     { this.playSFX('anchor'); }
    playZoneEnter() { this.playSFX('bell'); }
    playZoneExit()  { }
    playCollect()   { this.playSFX('coin'); }
    playUIClick()   { this.playSFX('uiClick'); }
    playPanelOpen() { this.playSFX('panelOpen'); }
    playQuest()     { this.playSFX('quest'); }

    // ── Mute state ───────────────────────────────────────────────────────

    applyMute() {
        for (const key of ['ambient', 'musicDay', 'musicNight']) {
            if (this.sounds[key]) this.sounds[key].mute(this.musicMuted);
        }
        for (const key of ['hullCreak', 'wake', 'campfire', 'projector', 'rain']) {
            if (this.sounds[key]) this.sounds[key].mute(this.sfxMuted);
        }
        this.savePref();
        this.updateChip();
        this.experience.emit('audio:change');
    }

    toggleMusic() {
        this.musicMuted = !this.musicMuted;
        this.applyMute();
    }

    toggleSFX() {
        this.sfxMuted = !this.sfxMuted;
        this.applyMute();
    }

    toggleMute() {
        const newState = !(this.musicMuted && this.sfxMuted);
        this.musicMuted = newState;
        this.sfxMuted = newState;
        // Resume a context the browser may have suspended in the background
        if (!newState && Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume();
        this.applyMute();
    }
}
