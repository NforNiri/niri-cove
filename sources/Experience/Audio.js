import { Howl } from 'howler';
import Experience from './Experience.js';

/**
 * Sound design for the cove.
 * Loops: ocean ambience (music bucket), hull creak + wake wash (sfx bucket, speed driven).
 * One-shots: sail snap on boost, anchor splash on brake, bell on island arrival,
 * coin for doubloons, soft wood click for UI.
 */
export default class Audio {
    constructor() {
        this.experience = Experience.getInstance();

        this.musicMuted = true;
        this.sfxMuted = true;
        this.started = false;
        this.sounds = {};

        this.createSounds();
    }

    createSounds() {
        // Procedurally generated (CC0) WAVs in /static/sounds
        this.sounds.ambient = this.createHowl('/sounds/ocean-ambience.wav', { loop: true, volume: 0.25 });

        this.sounds.hullCreak = this.createHowl('/sounds/hull-creak.wav', { loop: true, volume: 0 });
        this.sounds.wake = this.createHowl('/sounds/wake-wash.wav', { loop: true, volume: 0 });

        this.sounds.sail = this.createHowl('/sounds/sail-snap.wav', { volume: 0.45 });
        this.sounds.anchor = this.createHowl('/sounds/anchor-splash.wav', { volume: 0.4 });
        this.sounds.bell = this.createHowl('/sounds/ship-bell.wav', { volume: 0.4 });
        this.sounds.coin = this.createHowl('/sounds/coin.wav', { volume: 0.4 });
        this.sounds.uiClick = this.createHowl('/sounds/wood-click.wav', { volume: 0.3 });
        this.sounds.panelOpen = this.createHowl('/sounds/parchment.wav', { volume: 0.35 });
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

    start() {
        if (this.started) return;
        this.started = true;

        if (this.sounds.ambient) {
            this.sounds.ambient.mute(this.musicMuted);
            this.sounds.ambient.play();
        }
        for (const key of ['hullCreak', 'wake']) {
            if (this.sounds[key]) {
                this.sounds[key].mute(this.sfxMuted);
                this.sounds[key].play();
            }
        }
    }

    /**
     * @param {number} speed horizontal hull speed (world units / s)
     * @param {boolean} isBoosting
     */
    update(speed, isBoosting) {
        if (!this.started || this.sfxMuted) return;

        const maxSpeed = isBoosting ? 11 : 7;
        const ratio = Math.min(speed / maxSpeed, 1);

        if (this.sounds.hullCreak) {
            this.sounds.hullCreak.volume(0.08 + ratio * 0.08);
        }
        if (this.sounds.wake) {
            this.sounds.wake.volume(Math.min(0.45, ratio * 0.5));
            this.sounds.wake.rate(0.85 + ratio * 0.35);
        }
    }

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

    toggleMusic() {
        this.musicMuted = !this.musicMuted;
        if (this.sounds.ambient) this.sounds.ambient.mute(this.musicMuted);
    }

    toggleSFX() {
        this.sfxMuted = !this.sfxMuted;
        for (const key of ['hullCreak', 'wake']) {
            if (this.sounds[key]) this.sounds[key].mute(this.sfxMuted);
        }
    }

    toggleMute() {
        const newState = !(this.musicMuted && this.sfxMuted);
        this.musicMuted = newState;
        this.sfxMuted = newState;
        if (this.sounds.ambient) this.sounds.ambient.mute(newState);
        for (const key of ['hullCreak', 'wake']) {
            if (this.sounds[key]) this.sounds[key].mute(newState);
        }
    }
}
