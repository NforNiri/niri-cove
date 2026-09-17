import gsap from 'gsap';
import Experience from '../Experience.js';
import { ISLANDS, SPAWN } from '../World/layout.js';

const ICONS = {
    about: '⌂',
    work: '⚒',
    creative: '✦',
    resume: '✕',
    contact: '☼',
    spawn: '⚓',
};

export default class GameMenu {
    constructor(ui) {
        this.experience = Experience.getInstance();
        this.ui = ui;
        this.isOpen = false;

        this.createElement();
        this.bindEvents();
    }

    createElement() {
        this.menuBtn = document.createElement('button');
        this.menuBtn.id = 'menu-btn';
        this.menuBtn.title = 'Chart (ESC)';
        this.menuBtn.setAttribute('aria-label', 'Open chart');
        this.menuBtn.innerHTML = `
            <span class="menu-bar"></span>
            <span class="menu-bar"></span>
            <span class="menu-bar"></span>
        `;
        document.body.appendChild(this.menuBtn);

        const islandButtons = ISLANDS.map((i) => `
            <button class="nav-btn" data-zone="${i.id}">
                <span class="nav-icon">${ICONS[i.id]}</span>
                <span class="nav-label">${i.label}</span>
                <span class="nav-sub">${i.subtitle}</span>
            </button>
        `).join('');

        this.overlay = document.createElement('div');
        this.overlay.id = 'game-menu';
        this.overlay.innerHTML = `
            <div class="menu-backdrop"></div>
            <div class="menu-container">
                <button class="menu-close" aria-label="Close">&times;</button>

                <div class="menu-header">
                    <p class="menu-eyebrow">The Chart</p>
                    <h2 class="menu-title">Niri's Cove</h2>
                    <p class="menu-subtitle">Sail to an island &bull; Settings &bull; Helm</p>
                </div>

                <div class="menu-body">
                    <div class="menu-section">
                        <h3 class="menu-section-title">Sail to</h3>
                        <div class="nav-grid" id="nav-grid">
                            ${islandButtons}
                            <button class="nav-btn nav-btn-spawn" data-zone="spawn">
                                <span class="nav-icon">${ICONS.spawn}</span>
                                <span class="nav-label">The Lagoon</span>
                                <span class="nav-sub">Start</span>
                            </button>
                        </div>
                    </div>

                    <div class="menu-section">
                        <h3 class="menu-section-title">Captain's Log</h3>
                        <button class="log-btn" id="menu-log-btn">
                            <span>How this cove was built</span>
                            <span class="log-arrow">→</span>
                        </button>
                    </div>

                    <div class="menu-section">
                        <h3 class="menu-section-title">Settings</h3>
                        <div class="settings-row">
                            <span class="settings-label">Quality</span>
                            <button class="settings-btn" id="menu-quality-btn">Fine</button>
                        </div>
                        <div class="settings-row">
                            <span class="settings-label">Music &amp; ambience</span>
                            <button class="settings-btn" id="menu-music-btn">Off</button>
                        </div>
                        <div class="settings-row">
                            <span class="settings-label">Sound effects</span>
                            <button class="settings-btn" id="menu-sfx-btn">Off</button>
                        </div>
                    </div>

                    <div class="menu-section">
                        <h3 class="menu-section-title">Helm</h3>
                        <div class="controls-guide">
                            <div class="key-group">
                                <h4 class="key-group-title">Sailing</h4>
                                <div class="key-row"><kbd>W</kbd><kbd>↑</kbd><span>Ahead</span></div>
                                <div class="key-row"><kbd>S</kbd><kbd>↓</kbd><span>Astern</span></div>
                                <div class="key-row"><kbd>A</kbd><kbd>←</kbd><span>Port</span></div>
                                <div class="key-row"><kbd>D</kbd><kbd>→</kbd><span>Starboard</span></div>
                            </div>
                            <div class="key-group">
                                <h4 class="key-group-title">Actions</h4>
                                <div class="key-row"><kbd>Shift</kbd><span>Full sail</span></div>
                                <div class="key-row"><kbd>Space</kbd><span>Drop anchor</span></div>
                                <div class="key-row"><kbd>M</kbd><span>Mute</span></div>
                                <div class="key-row"><kbd>H</kbd><span>Quality</span></div>
                                <div class="key-row"><kbd>ESC</kbd><span>Chart</span></div>
                            </div>
                        </div>
                        <p class="mobile-note">On a phone: steer with the compass, full sail and anchor on the right.</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        gsap.set(this.overlay, { opacity: 0, visibility: 'hidden' });
        gsap.set(this.overlay.querySelector('.menu-container'), { y: 30, scale: 0.96 });
    }

    bindEvents() {
        this.menuBtn.addEventListener('click', () => this.toggle());
        this.overlay.querySelector('.menu-close').addEventListener('click', () => this.close());
        this.overlay.querySelector('.menu-backdrop').addEventListener('click', () => this.close());

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') this.toggle();
        });

        this.overlay.querySelectorAll('.nav-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.sailTo(btn.dataset.zone));
        });

        this.overlay.querySelector('#menu-log-btn').addEventListener('click', () => {
            this.close();
            if (this.ui) this.ui.openStatic('captainslog');
        });

        this.overlay.querySelector('#menu-quality-btn').addEventListener('click', () => {
            if (this.experience.renderer) {
                this.experience.renderer.toggleQuality();
                this.updateSettingsDisplay();
            }
        });
        this.overlay.querySelector('#menu-music-btn').addEventListener('click', () => {
            if (this.experience.audio) {
                this.experience.audio.toggleMusic();
                this.updateSettingsDisplay();
            }
        });
        this.overlay.querySelector('#menu-sfx-btn').addEventListener('click', () => {
            if (this.experience.audio) {
                this.experience.audio.toggleSFX();
                this.updateSettingsDisplay();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;

        this.updateSettingsDisplay();
        this.menuBtn.classList.add('active');

        const container = this.overlay.querySelector('.menu-container');
        gsap.killTweensOf([this.overlay, container]);
        gsap.to(this.overlay, { opacity: 1, visibility: 'visible', duration: 0.3, ease: 'power2.out' });
        gsap.to(container, { y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.4)' });

        gsap.fromTo(this.overlay.querySelectorAll('.nav-btn'), { y: 14, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.3, stagger: 0.04, delay: 0.12, ease: 'power2.out'
        });

        if (this.experience.audio) this.experience.audio.playUIClick();
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.menuBtn.classList.remove('active');

        const container = this.overlay.querySelector('.menu-container');
        gsap.killTweensOf([this.overlay, container]);
        gsap.to(container, { y: 20, scale: 0.96, duration: 0.25, ease: 'power2.in' });
        gsap.to(this.overlay, {
            opacity: 0, duration: 0.3, ease: 'power2.in',
            onComplete: () => gsap.set(this.overlay, { visibility: 'hidden' })
        });
    }

    updateSettingsDisplay() {
        const q = this.overlay.querySelector('#menu-quality-btn');
        const m = this.overlay.querySelector('#menu-music-btn');
        const s = this.overlay.querySelector('#menu-sfx-btn');

        if (this.experience.renderer) {
            q.textContent = this.experience.renderer.quality === 'high' ? 'Fine' : 'Swift';
        }
        if (this.experience.audio) {
            m.textContent = this.experience.audio.musicMuted ? 'Off' : 'On';
            m.classList.toggle('is-on', !this.experience.audio.musicMuted);
            s.textContent = this.experience.audio.sfxMuted ? 'Off' : 'On';
            s.classList.toggle('is-on', !this.experience.audio.sfxMuted);
        }
    }

    /**
     * Move the boat to just outside an island's dock, facing the pier.
     */
    sailTo(zoneId) {
        const world = this.experience.world;
        if (!world || !world.boat) return;

        let x, z, yaw;
        if (zoneId === 'spawn') {
            x = SPAWN.x; z = SPAWN.z; yaw = 0;
        } else {
            const island = ISLANDS.find((i) => i.id === zoneId);
            if (!island) return;
            x = island.approach.x;
            z = island.approach.z;
            // Boat forward is -Z; rotating (0,0,-1) by yaw gives (-sin, -cos), so
            // yaw = atan2(ux, uz) points the bow at the island (against dockDir)
            yaw = Math.atan2(island.dockDir.x, island.dockDir.z);
        }

        world.boat.reset(x, z, yaw);
        this.close();
        if (this.experience.audio) this.experience.audio.playUIClick();
    }
}
