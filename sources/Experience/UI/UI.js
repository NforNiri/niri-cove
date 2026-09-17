import gsap from 'gsap';
import Experience from '../Experience.js';
import Panel from './Panel.js';
import GameMenu from './GameMenu.js';
import TreasureMap from './TreasureMap.js';
import Hints from './Hints.js';
import Commendation from './Commendation.js';
import { getContent } from './panels/index.js';
import { DOUBLOON_TOTAL } from '../Utils/Progress.js';

export default class UI {
    constructor() {
        this.experience = Experience.getInstance();
        this.progress = this.experience.progress;

        this.panel = new Panel();
        this.gameMenu = new GameMenu(this);
        this.treasureMap = new TreasureMap(this);
        this.hints = new Hints(this);
        this.commendation = new Commendation(this);
        this.exitTimeout = null;

        this.createToast();

        this.experience.on('zone:enter', (zoneId) => this.onZoneEnter(zoneId));
        this.experience.on('zone:exit', (zoneId) => this.onZoneExit(zoneId));
        this.experience.on('intro:done', () => this.onIntroDone());
        this.experience.on('progress:unlock', (reward) => this.onUnlock(reward));

        // Outbound clicks inside panels (for analytics)
        this.panel.element.addEventListener('click', (e) => {
            const a = e.target.closest('a[href]');
            if (!a) return;
            if (a.dataset.track) this.experience.emit('panel:track', a.dataset.track);
            else if (a.href.startsWith('http')) this.experience.emit('panel:link', a.href);
        });
    }

    onZoneEnter(zoneId) {
        if (this.exitTimeout) {
            clearTimeout(this.exitTimeout);
            this.exitTimeout = null;
        }
        const first = this.progress.visitIsland(zoneId);
        const content = getContent(zoneId);
        if (content) this.panel.show(zoneId, content);
        if (first) {
            const left = 5 - this.progress.islandsVisited;
            if (left > 0) this.toast(`ISLAND CHARTED — ${left} TO GO`);
            else this.toast('EVERY ISLAND CHARTED, CAPTAIN');
        }
    }

    onZoneExit() {
        // Small delay so brushing past a buoy doesn't flicker the panel
        this.exitTimeout = setTimeout(() => {
            this.panel.hide();
            this.exitTimeout = null;
        }, 600);
    }

    onIntroDone() {
        if (this.progress.returning) {
            const left = DOUBLOON_TOTAL - this.progress.doubloons;
            const msg = left > 0
                ? `WELCOME BACK, CAPTAIN — ${left} DOUBLOON${left === 1 ? '' : 'S'} STILL OUT THERE`
                : 'WELCOME BACK, CAPTAIN — THE COVE IS YOURS';
            setTimeout(() => this.toast(msg, 3600), 600);
        }
    }

    onUnlock(reward) {
        setTimeout(() => this.toast(`UNLOCKED: ${reward.title.toUpperCase()}`, 3200), 900);
        if (reward.id === 'gold') {
            this.progress.select('sail', 'gold');
            setTimeout(() => this.commendation.open(), 2600);
        }
    }

    /** Open a non-zone panel (e.g. the Captain's Log from the menu). */
    openStatic(id) {
        const content = getContent(id);
        if (content) this.panel.show(id, content);
    }

    // ── Toast ────────────────────────────────────────────────────────────

    createToast() {
        this.toastEl = document.createElement('div');
        this.toastEl.className = 'collect-toast';
        this.toastEl.style.opacity = '0';
        document.body.appendChild(this.toastEl);
    }

    toast(text, hold = 2200) {
        this.toastEl.textContent = text;
        gsap.killTweensOf(this.toastEl);
        gsap.fromTo(this.toastEl, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
        gsap.to(this.toastEl, { opacity: 0, delay: hold / 1000, duration: 0.5, ease: 'power2.in' });
    }
}
