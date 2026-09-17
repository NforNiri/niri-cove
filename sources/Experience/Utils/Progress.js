import Experience from '../Experience.js';

const KEY = 'cove.progress.v1';
const SAVE_EVERY_MS = 8000;

export const DOUBLOON_TOTAL = 20;

// Threshold rewards for doubloons
export const REWARDS = [
    { at: 5,  id: 'sail',    title: 'Sail colours',    text: 'Dye the sail from the Chart menu.' },
    { at: 10, id: 'gull',    title: 'Gull companion',  text: 'A gull now follows your boat.' },
    { at: 15, id: 'lantern', title: 'Lantern hues',    text: 'Choose a lantern colour from the Chart menu.' },
    { at: DOUBLOON_TOTAL, id: 'gold', title: 'Golden sail + Commendation', text: 'The cove is yours, Captain.' },
];

// Cosmetic unlocks
export const SAIL_COLORS = [
    { id: 'canvas',   label: 'Canvas',   hex: 0xFFFFFF },
    { id: 'crimson',  label: 'Crimson',  hex: 0xC8443C, reward: 'sail' },
    { id: 'teal',     label: 'Lagoon',   hex: 0x4FB8AE, reward: 'sail' },
    { id: 'midnight', label: 'Midnight', hex: 0x3D4F78, reward: 'sail' },
    { id: 'gold',     label: 'Golden',   hex: 0xE3B341, reward: 'gold' },
];

export const LANTERN_COLORS = [
    { id: 'amber',   label: 'Amber',   hex: 0xFFB067 },
    { id: 'emerald', label: 'Emerald', hex: 0x5FE0A0, reward: 'lantern' },
    { id: 'violet',  label: 'Violet',  hex: 0xB68CFF, reward: 'lantern' },
    { id: 'ice',     label: 'Ice',     hex: 0x9AD8FF, reward: 'lantern' },
];

export const QUESTS = [
    { id: 'campfire',  island: 'about',    title: 'Light the campfire',   hint: 'Moor at Home Cove and warm the beach.' },
    { id: 'cannon',    island: 'work',     title: 'Fire the cannon',      hint: 'The Shipyard gun has been quiet too long.' },
    { id: 'projector', island: 'creative', title: 'Start the projector',  hint: 'Lantern Bay screens a reel after dark.' },
    { id: 'dig',       island: 'resume',   title: 'Dig at the X',         hint: 'Treasure Rock keeps the Captain\'s papers.' },
    { id: 'bell',      island: 'contact',  title: 'Ring the bell',        hint: 'Lighthouse Point answers a bell.' },
];

function fresh() {
    const now = Date.now();
    return {
        version: 1,
        firstVisit: now,
        lastVisit: now,
        visits: 1,
        sailTime: 0,          // seconds with the experience running
        islands: {},          // id -> first visit timestamp
        doubloons: [],        // collected ids
        quests: {},           // id -> completion timestamp
        secrets: {},          // id -> timestamp (kraken, bottle...)
        selected: { sail: 'canvas', lantern: 'amber' },
        commendationSeen: false,
    };
}

/**
 * Persistent visitor progress (localStorage). Emits through Experience:
 *   progress:island  (id)     progress:doubloon (id, count)
 *   progress:quest   (id)     progress:unlock   (reward)
 *   progress:change
 */
export default class Progress {
    constructor() {
        this.experience = Experience.getInstance();
        this.dirty = false;
        this.lastSave = performance.now();
        this.returning = this.load();
        if (this.returning) this.state.visits += 1;
        this.state.lastVisit = Date.now();
        this.dirty = true;

        this.experience.addUpdate(9, () => this.update());
        window.addEventListener('beforeunload', () => this.save(true));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.save(true);
        });
    }

    /** @returns {boolean} true when a previous visit was found */
    load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.version === 1) {
                    this.state = { ...fresh(), ...parsed, selected: { ...fresh().selected, ...(parsed.selected || {}) } };
                    return true;
                }
            }
        } catch (e) { /* private mode or corrupt */ }
        this.state = fresh();
        return false;
    }

    save(force = false) {
        if (!this.dirty && !force) return;
        try {
            localStorage.setItem(KEY, JSON.stringify(this.state));
        } catch (e) { /* ignore */ }
        this.dirty = false;
        this.lastSave = performance.now();
    }

    update() {
        this.state.sailTime += this.experience.time.delta / 1000;
        if (performance.now() - this.lastSave > SAVE_EVERY_MS) {
            this.dirty = true;
            this.save();
        }
    }

    touch(event, ...args) {
        this.dirty = true;
        if (event) this.experience.emit(event, ...args);
        this.experience.emit('progress:change');
    }

    // ── Islands ──────────────────────────────────────────────────────────

    hasVisited(id) { return !!this.state.islands[id]; }
    get islandsVisited() { return Object.keys(this.state.islands).length; }

    visitIsland(id) {
        if (this.state.islands[id]) return false;
        this.state.islands[id] = Date.now();
        this.touch('progress:island', id);
        return true;
    }

    // ── Doubloons ────────────────────────────────────────────────────────

    hasDoubloon(id) { return this.state.doubloons.includes(id); }
    get doubloons() { return this.state.doubloons.length; }

    collectDoubloon(id) {
        if (this.hasDoubloon(id)) return false;
        const before = this.doubloons;
        this.state.doubloons.push(id);
        this.touch('progress:doubloon', id, this.doubloons);
        for (const r of REWARDS) {
            if (before < r.at && this.doubloons >= r.at) this.experience.emit('progress:unlock', r);
        }
        return true;
    }

    hasReward(id) {
        const r = REWARDS.find((k) => k.id === id);
        return !!r && this.doubloons >= r.at;
    }

    // ── Quests ───────────────────────────────────────────────────────────

    hasQuest(id) { return !!this.state.quests[id]; }
    get questsDone() { return Object.keys(this.state.quests).length; }

    completeQuest(id) {
        if (this.state.quests[id]) return false;
        this.state.quests[id] = Date.now();
        this.touch('progress:quest', id);
        return true;
    }

    // ── Secrets / selections ─────────────────────────────────────────────

    hasSecret(id) { return !!this.state.secrets[id]; }

    addSecret(id) {
        if (this.state.secrets[id]) return false;
        this.state.secrets[id] = Date.now();
        this.touch('progress:secret', id);
        return true;
    }

    select(kind, value) {
        this.state.selected[kind] = value;
        this.touch('progress:select', kind, value);
    }

    get selected() { return this.state.selected; }

    markCommendationSeen() {
        this.state.commendationSeen = true;
        this.touch(null);
    }

    /** Everything found. */
    get complete() {
        return this.doubloons >= DOUBLOON_TOTAL;
    }

    /** "3m 20s" style */
    get sailTimeLabel() {
        const s = Math.floor(this.state.sailTime);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (h) return `${h}h ${m}m`;
        return `${m}m ${s % 60}s`;
    }

    /** Dev helper */
    reset() {
        this.state = fresh();
        this.save(true);
        this.experience.emit('progress:change');
    }
}
