import gsap from 'gsap';
import Experience from '../Experience.js';
import { SAIL_COLORS, LANTERN_COLORS, REWARDS, DOUBLOON_TOTAL } from '../Utils/Progress.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export default class GameMenu {
    constructor(ui) {
        this.experience = Experience.getInstance();
        this.progress = this.experience.progress;
        this.ui = ui;
        this.isOpen = false;

        this.createElement();
        this.bindEvents();

        this.experience.on('progress:change', () => { if (this.isOpen) this.updateColours(); });
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

        this.overlay = document.createElement('div');
        this.overlay.id = 'game-menu';
        this.overlay.innerHTML = `
            <div class="menu-backdrop"></div>
            <div class="menu-container">
                <button class="menu-close" aria-label="Close">&times;</button>

                <div class="menu-header">
                    <p class="menu-eyebrow">The Chart</p>
                    <h2 class="menu-title">Niri's Cove</h2>
                    <p class="menu-subtitle">Treasure map &bull; Ship's colours &bull; Settings &bull; Helm</p>
                </div>

                <div class="menu-body">
                    <div class="menu-section">
                        <h3 class="menu-section-title">Navigation</h3>
                        <button class="log-btn" id="menu-map-btn">
                            <span>Open the treasure map &mdash; sail to any island</span>
                            <span class="log-arrow">→</span>
                        </button>
                    </div>

                    <div class="menu-section">
                        <h3 class="menu-section-title">Ship's colours</h3>
                        <p class="menu-note" id="menu-colours-note"></p>
                        <div class="colour-row">
                            <span class="settings-label">Sail</span>
                            <div class="swatches" id="sail-swatches"></div>
                        </div>
                        <div class="colour-row">
                            <span class="settings-label">Lantern</span>
                            <div class="swatches" id="lantern-swatches"></div>
                        </div>
                    </div>

                    <div class="menu-section">
                        <h3 class="menu-section-title">Captain's Log</h3>
                        <button class="log-btn" id="menu-log-btn">
                            <span>Deeds, discoveries and how this cove was built</span>
                            <span class="log-arrow">→</span>
                        </button>
                        <button class="log-btn" id="menu-commendation-btn">
                            <span>Captain's Commendation</span>
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
                                <div class="key-row"><kbd>E</kbd><span>Act / interact</span></div>
                                <div class="key-row"><kbd>C</kbd><span>Treasure map</span></div>
                                <div class="key-row"><kbd>M</kbd><span>Mute</span></div>
                                <div class="key-row"><kbd>H</kbd><span>Quality</span></div>
                                <div class="key-row"><kbd>ESC</kbd><span>Chart</span></div>
                            </div>
                        </div>
                        <p class="mobile-note">On a phone: steer with the compass; full sail, anchor and act are on the right.</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);

        gsap.set(this.overlay, { opacity: 0, visibility: 'hidden' });
        gsap.set(this.overlay.querySelector('.menu-container'), { y: 30, scale: 0.96 });

        this.buildSwatches();
    }

    buildSwatches() {
        const build = (container, list, kind) => {
            container.innerHTML = list.map((c) => `
                <button class="swatch" data-kind="${kind}" data-id="${c.id}" style="--swatch:${hex(c.hex)}" title="${c.label}" aria-label="${c.label}">
                    <span class="swatch-lock">🔒</span>
                </button>
            `).join('');
        };
        build(this.overlay.querySelector('#sail-swatches'), SAIL_COLORS, 'sail');
        build(this.overlay.querySelector('#lantern-swatches'), LANTERN_COLORS, 'lantern');
        this.overlay.querySelectorAll('.swatch').forEach((b) => {
            b.addEventListener('click', () => this.pickColour(b.dataset.kind, b.dataset.id));
        });
        this.updateColours();
    }

    updateColours() {
        const sel = this.progress.selected;
        this.overlay.querySelectorAll('.swatch').forEach((b) => {
            const list = b.dataset.kind === 'sail' ? SAIL_COLORS : LANTERN_COLORS;
            const c = list.find((k) => k.id === b.dataset.id);
            const locked = !!c.reward && !this.progress.hasReward(c.reward);
            b.classList.toggle('is-locked', locked);
            b.classList.toggle('is-active', sel[b.dataset.kind] === c.id);
        });
        const n = this.progress.doubloons;
        const next = REWARDS.find((r) => n < r.at);
        const note = this.overlay.querySelector('#menu-colours-note');
        note.textContent = next
            ? `${n} / ${DOUBLOON_TOTAL} doubloons — ${next.at - n} more unlock ${next.title.toLowerCase()}.`
            : 'Every doubloon found. All colours unlocked.';
    }

    pickColour(kind, id) {
        const list = kind === 'sail' ? SAIL_COLORS : LANTERN_COLORS;
        const c = list.find((k) => k.id === id);
        if (!c) return;
        if (c.reward && !this.progress.hasReward(c.reward)) {
            if (this.ui) this.ui.toast('STILL LOCKED — FIND MORE DOUBLOONS', 1800);
            return;
        }
        this.progress.select(kind, id);
        this.updateColours();
        if (this.experience.audio) this.experience.audio.playUIClick();
    }

    bindEvents() {
        this.menuBtn.addEventListener('click', () => this.toggle());
        this.overlay.querySelector('.menu-close').addEventListener('click', () => this.close());
        this.overlay.querySelector('.menu-backdrop').addEventListener('click', () => this.close());

        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Escape') return;
            // ESC closes the chart / commendation first
            if (this.ui && this.ui.treasureMap && this.ui.treasureMap.isOpen) return;
            if (this.ui && this.ui.commendation && this.ui.commendation.isOpen) return;
            if (document.body.classList.contains('intro-active')) return;
            this.toggle();
        });

        this.overlay.querySelector('#menu-map-btn').addEventListener('click', () => {
            this.close();
            if (this.ui && this.ui.treasureMap) setTimeout(() => this.ui.treasureMap.open(), 200);
        });

        this.overlay.querySelector('#menu-log-btn').addEventListener('click', () => {
            this.close();
            if (this.ui) this.ui.openStatic('captainslog');
        });

        this.overlay.querySelector('#menu-commendation-btn').addEventListener('click', () => {
            this.close();
            if (this.ui && this.ui.commendation) setTimeout(() => this.ui.commendation.open(), 200);
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
        this.experience.on('audio:change', () => { if (this.isOpen) this.updateSettingsDisplay(); });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;

        this.updateSettingsDisplay();
        this.updateColours();
        this.menuBtn.classList.add('active');

        const container = this.overlay.querySelector('.menu-container');
        gsap.killTweensOf([this.overlay, container]);
        gsap.to(this.overlay, { opacity: 1, visibility: 'visible', duration: 0.3, ease: 'power2.out' });
        gsap.to(container, { y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.4)' });

        gsap.fromTo(this.overlay.querySelectorAll('.menu-section'), { y: 14, opacity: 0 }, {
            y: 0, opacity: 1, duration: 0.3, stagger: 0.05, delay: 0.1, ease: 'power2.out'
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
}
