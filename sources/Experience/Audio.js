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
        // Procedurally generated (CC0) WAVs in /static/sounds
        this.sounds.ambient = this.createHowl('/sounds/ocean-ambience.wav', { loop: true, volume: 0.22 });
        this.sounds.musicDay = this.createHowl('/sounds/music-day.wav', { loop: true, volume: 0 });
        this.sounds.musicNight = this.createHowl('/sounds/music-night.wav', { loop: true, volume: 0 });

        this.sounds.hullCreak = this.createHowl('/sounds/hull-creak.wav', { loop: true, volume: 0 });
        this.sounds.wake = this.createHowl('/sounds/wake-wash.wav', { loop: true, volume: 0 });

        this.sounds.sail = this.createHowl('/sounds/sail-snap.wav', { volume: 0.45 });
        this.sounds.anchor = this.createHowl('/sounds/anchor-splash.wav', { volume: 0.4 });
        this.sounds.bell = this.createHowl('/sounds/ship-bell.wav', { volume: 0.4 });
        this.sounds.coin = this.createHowl('/sounds/coin.wav', { volume: 0.4 });
        this.sounds.uiClick = this.createHowl('/sounds/wood-click.wav', { volume: 0.3 });
        this.sounds.panelOpen = this.createHowl('/sounds/parchment.wav', { volume: 0.35 });

        // Quest / event one-shots
        this.sounds.cannon = this.createHowl('/sounds/cannon.wav', { volume: 0.55 });
        this.sounds.dig = this.createHowl('/sounds/dig.wav', { volume: 0.45 });
        this.sounds.chest = this.createHowl('/sounds/chest-open.wav', { volume: 0.45 });
        this.sounds.quest = this.createHowl('/sounds/quest.wav', { volume: 0.45 });
        this.sounds.splash = this.createHowl('/sounds/splash.wav', { volume: 0.4 });
        this.sounds.gull = this.createHowl('/sounds/gull.wav', { volume: 0.3 });

        // Positional loops (volume set per frame from distance)
        this.sounds.campfire = this.createHowl('/sounds/campfire.wav', { loop: true, volume: 0 });
        this.sounds.projector = this.createHowl('/sounds/projector.wav', { loop: true, volume: 0 });
    }

    createHowl(src, options = {}) {
        try {
            return new Howl({
                src: [src],
                ...options,
                onloaderror: () => console.warn(`Audio not found: ${src} — skipping`)
            });
        } catch (e) {
            return null;
        }
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
            s.play();
        }
        for (const key of ['hullCreak', 'wake', 'campfire', 'projector']) {
            const s = this.sounds[key];
            if (!s) continue;
            s.mute(this.sfxMuted);
            if (key !== 'projector') s.play();
        }
        this.applyMusicMix();
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
        const id = s.play();
        s.volume(gain * volume * this.baseVolume(key), id);
        s.stereo(pan, id);
    }

    baseVolume(key) {
        const base = { gull: 0.3, bell: 0.4, splash: 0.4, cannon: 0.55 };
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
            if (e.key === 'projector' && gain > 0 && !s.playing()) s.play();
        }
    }

    applyMusicMix() {
        const day = this.sounds.musicDay;
        const nightStem = this.sounds.musicNight;
        // Equal-power crossfade, kept under the ambience so it never nags
        const n = THREE.MathUtils.clamp(this.night, 0, 1);
        if (day) day.volume(Math.cos(n * Math.PI / 2) * 0.28);
        if (nightStem) nightStem.volume(Math.sin(n * Math.PI / 2) * 0.3);
    }

    // ── One-shots ────────────────────────────────────────────────────────

    playSFX(key) {
        if (!this.started || this.sfxMuted) return;
        if (this.sounds[key]) this.sounds[key].play();
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
        for (const key of ['hullCreak', 'wake', 'campfire', 'projector']) {
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
