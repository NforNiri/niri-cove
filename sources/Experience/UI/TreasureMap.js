import gsap from 'gsap';
import Experience from '../Experience.js';
import { ISLANDS, SHOALS, DOUBLOONS, SPAWN } from '../World/layout.js';
import { DOUBLOON_TOTAL, QUESTS } from '../Utils/Progress.js';

// World half-extent shown on the chart (units)
const RANGE = 82;
const HUD_SIZE = 156;

const INK = '#1E2A2B';
const SAND = '#E6CF9C';
const GRASS = '#7FB069';
const GOLD = '#E3B341';
const WAX = '#B3322E';
const SEA_LINE = 'rgba(30, 42, 43, 0.18)';

/**
 * Parchment chart of the cove. A small round minimap in the HUD (boat, islands,
 * wax stamps for visited ones, nearby doubloon hints, a compass needle toward the
 * nearest unvisited island) that expands to a full chart with teleport.
 */
export default class TreasureMap {
    constructor(ui) {
        this.experience = Experience.getInstance();
        this.time = this.experience.time;
        this.progress = this.experience.progress;
        this.ui = ui;
        this.isOpen = false;
        this.frame = 0;

        this.createHud();
        this.createChart();
        this.bind();

        this.experience.addUpdate(9, () => this.update());
        this.experience.on('intro:done', () => this.pulse());
        this.experience.on('progress:change', () => { this.updateCounter(); if (this.isOpen) this.drawChart(); });
    }

    // ── DOM ──────────────────────────────────────────────────────────────

    createHud() {
        this.hud = document.createElement('div');
        this.hud.id = 'treasure-map';
        this.hud.innerHTML = `
            <button class="map-disc parchment" type="button" aria-label="Open the treasure map (C)">
                <canvas class="map-canvas"></canvas>
                <span class="map-n">N</span>
            </button>
            <div class="map-compass-label"></div>
            <div class="map-counter"><span class="map-coin"></span><span class="map-counter-text"></span></div>
        `;
        document.body.appendChild(this.hud);
        this.hudCanvas = this.hud.querySelector('.map-canvas');
        this.compassLabel = this.hud.querySelector('.map-compass-label');
        this.counterText = this.hud.querySelector('.map-counter-text');
        this.setupCanvas(this.hudCanvas, HUD_SIZE);
        this.updateCounter();
    }

    createChart() {
        this.chart = document.createElement('div');
        this.chart.id = 'chart-overlay';
        this.chart.innerHTML = `
            <div class="chart-backdrop"></div>
            <div class="chart-sheet parchment">
                <button class="chart-close" aria-label="Close">&times;</button>
                <p class="chart-eyebrow">The Treasure Map</p>
                <h2 class="chart-title">Niri's Cove</h2>
                <div class="chart-canvas-wrap">
                    <canvas class="chart-canvas"></canvas>
                    <div class="chart-hotspots"></div>
                </div>
                <div class="chart-stats"></div>
                <p class="chart-hint">Tap an island to sail there &bull; wax seals mark islands you have visited</p>
            </div>
        `;
        document.body.appendChild(this.chart);
        this.chartCanvas = this.chart.querySelector('.chart-canvas');
        this.hotspots = this.chart.querySelector('.chart-hotspots');
        this.statsEl = this.chart.querySelector('.chart-stats');
        gsap.set(this.chart, { opacity: 0, visibility: 'hidden' });
    }

    setupCanvas(canvas, size) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvas._size = size;
        canvas._ctx = ctx;
    }

    bind() {
        this.hud.querySelector('.map-disc').addEventListener('click', () => this.toggle());
        this.chart.querySelector('.chart-close').addEventListener('click', () => this.close());
        this.chart.querySelector('.chart-backdrop').addEventListener('click', () => this.close());
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyC' && !e.repeat) this.toggle();
            if (e.code === 'Escape' && this.isOpen) this.close();
        });
        window.addEventListener('resize', () => { if (this.isOpen) this.layoutChart(); });
    }

    pulse() {
        this.hud.classList.add('is-pulsing');
        setTimeout(() => this.hud.classList.remove('is-pulsing'), 6000);
    }

    // ── Projection ───────────────────────────────────────────────────────

    toMap(x, z, size) {
        const half = size / 2;
        return { x: half + (x / RANGE) * half * 0.92, y: half + (z / RANGE) * half * 0.92 };
    }

    /** Nearest island the visitor hasn't docked at (null when all seen). */
    compassTarget(boatPos) {
        let best = null;
        let bestD = Infinity;
        for (const isl of ISLANDS) {
            if (this.progress.hasVisited(isl.id)) continue;
            const d = Math.hypot(isl.dock.x - boatPos.x, isl.dock.z - boatPos.z);
            if (d < bestD) { bestD = d; best = isl; }
        }
        return best ? { island: best, dist: bestD } : null;
    }

    // ── Drawing ──────────────────────────────────────────────────────────

    drawBase(ctx, size, { labels = false } = {}) {
        ctx.clearRect(0, 0, size, size);
        const s = size / HUD_SIZE; // scale factor relative to the HUD

        // Rhumb lines
        ctx.save();
        ctx.strokeStyle = SEA_LINE;
        ctx.lineWidth = 1;
        const c = size / 2;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI;
            ctx.beginPath();
            ctx.moveTo(c + Math.cos(a) * c, c + Math.sin(a) * c);
            ctx.lineTo(c - Math.cos(a) * c, c - Math.sin(a) * c);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(c, c, c * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Shoals
        for (const sh of SHOALS) {
            const p = this.toMap(sh.x, sh.z, size);
            ctx.fillStyle = 'rgba(230, 207, 156, 0.75)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, sh.radius * 0.5 * s, sh.radius * 0.32 * s, 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Islands
        for (const isl of ISLANDS) {
            const p = this.toMap(isl.x, isl.z, size);
            const r = (isl.radius / RANGE) * (size / 2) * 0.92;
            ctx.fillStyle = SAND;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * 1.02, r * 0.9, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = GRASS;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * 0.62, r * 0.52, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(90, 58, 30, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, r * 1.02, r * 0.9, 0.3, 0, Math.PI * 2);
            ctx.stroke();

            // Pier tick
            const tip = this.toMap(isl.pierTip.x, isl.pierTip.z, size);
            ctx.strokeStyle = '#8B5A2B';
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.moveTo(p.x + (tip.x - p.x) * 0.75, p.y + (tip.y - p.y) * 0.75);
            ctx.lineTo(tip.x, tip.y);
            ctx.stroke();

            if (this.progress.hasVisited(isl.id)) this.drawSeal(ctx, p.x + r * 0.55, p.y - r * 0.55, 6 * s);

            if (labels) {
                // Type grows much slower than the map so names never collide
                const fs = Math.min(1 + (s - 1) * 0.3, 1.7);
                ctx.fillStyle = INK;
                ctx.font = `${Math.round(14 * fs)}px "Pirata One", "Cinzel", serif`;
                ctx.textAlign = 'center';
                ctx.fillText(isl.label, p.x, p.y + r + 15 * fs);
                ctx.font = `${Math.round(8 * fs)}px Cinzel, serif`;
                ctx.fillStyle = 'rgba(30, 42, 43, 0.65)';
                ctx.fillText(isl.subtitle.toUpperCase(), p.x, p.y + r + 26 * fs);
            }
        }

        // Lagoon anchor
        const sp = this.toMap(SPAWN.x, SPAWN.z, size);
        ctx.fillStyle = 'rgba(30, 42, 43, 0.35)';
        ctx.font = `${Math.round(10 * Math.min(s, 1.8))}px serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⚓', sp.x, sp.y + 3 * Math.min(s, 1.8));
    }

    drawSeal(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = WAX;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = Math.max(1, r * 0.22);
        ctx.beginPath();
        ctx.moveTo(x - r * 0.45, y);
        ctx.lineTo(x - r * 0.1, y + r * 0.4);
        ctx.lineTo(x + r * 0.5, y - r * 0.4);
        ctx.stroke();
        ctx.restore();
    }

    drawDoubloons(ctx, size, boatPos, { all = false } = {}) {
        const s = size / HUD_SIZE;
        const t = this.time.elapsed / 1000;
        for (const d of DOUBLOONS) {
            if (this.progress.hasDoubloon(d.id)) continue;
            const dist = boatPos ? Math.hypot(d.x - boatPos.x, d.z - boatPos.z) : 0;
            // Hints reveal as you get close; hidden ones only on the full chart, faintly
            let alpha;
            if (all) alpha = d.hidden ? 0.35 : 0.85;
            else if (d.hidden) continue;
            else alpha = Math.max(0, 1 - dist / 45) * 0.95;
            if (alpha < 0.05) continue;
            const p = this.toMap(d.x, d.z, size);
            ctx.globalAlpha = alpha * (0.75 + Math.sin(t * 3 + d.x) * 0.25);
            ctx.fillStyle = GOLD;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.4 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    drawBoat(ctx, size, boatPos, heading) {
        const s = size / HUD_SIZE;
        const p = this.toMap(boatPos.x, boatPos.z, size);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(0, -6 * s);
        ctx.lineTo(4.2 * s, 5 * s);
        ctx.lineTo(0, 3 * s);
        ctx.lineTo(-4.2 * s, 5 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawNeedle(ctx, size, boatPos, target) {
        if (!target) return;
        const c = size / 2;
        const a = Math.atan2(target.island.dock.z - boatPos.z, target.island.dock.x - boatPos.x);
        const r = c - 7;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = WAX;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 4);
        ctx.lineTo(-5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ── HUD update ───────────────────────────────────────────────────────

    update() {
        const world = this.experience.world;
        if (!world || !world.boat || !world.boat.rigidBody) return;
        // Every other frame is plenty for a 156px chart
        if ((this.frame++ & 1) === 1 && !this.isOpen) return;

        const boatPos = world.boat.getPosition();
        const f = world.boat.forward;
        const heading = Math.atan2(f.x, -f.z);
        const target = this.compassTarget(boatPos);

        const ctx = this.hudCanvas._ctx;
        const size = this.hudCanvas._size;
        this.drawBase(ctx, size);
        this.drawDoubloons(ctx, size, boatPos);
        this.drawBoat(ctx, size, boatPos, heading);
        this.drawNeedle(ctx, size, boatPos, target);

        if (target) {
            this.compassLabel.textContent = `${target.island.label} · ${Math.round(target.dist)}m`;
            this.compassLabel.classList.remove('is-done');
        } else {
            this.compassLabel.textContent = 'All islands charted';
            this.compassLabel.classList.add('is-done');
        }

        if (this.isOpen && (this.frame & 3) === 0) this.drawChart();
    }

    updateCounter() {
        this.counterText.textContent = `${this.progress.doubloons} / ${DOUBLOON_TOTAL}`;
        this.hud.querySelector('.map-counter').classList.toggle('is-complete', this.progress.complete);
    }

    bumpCounter() {
        const el = this.hud.querySelector('.map-counter');
        el.classList.remove('is-bumping');
        void el.offsetWidth;
        el.classList.add('is-bumping');
    }

    // ── Full chart ───────────────────────────────────────────────────────

    layoutChart() {
        const wrap = this.chart.querySelector('.chart-canvas-wrap');
        const size = Math.floor(Math.min(wrap.clientWidth, window.innerHeight * 0.58, 640));
        this.setupCanvas(this.chartCanvas, size);
        this.chartCanvas.style.width = `${size}px`;
        this.chartCanvas.style.height = `${size}px`;
        wrap.style.height = `${size}px`;

        // Clickable island hotspots over the drawing
        this.hotspots.innerHTML = '';
        const targets = [...ISLANDS.map((i) => ({ id: i.id, x: i.x, z: i.z, label: i.label, radius: i.radius })), { id: 'spawn', x: SPAWN.x, z: SPAWN.z, label: 'The Lagoon', radius: 8 }];
        for (const t of targets) {
            const p = this.toMap(t.x, t.z, size);
            const r = Math.max(22, (t.radius / RANGE) * (size / 2) * 0.92 * 1.3);
            const b = document.createElement('button');
            b.className = 'chart-hotspot';
            b.dataset.zone = t.id;
            b.setAttribute('aria-label', `Sail to ${t.label}`);
            b.style.left = `${p.x - r}px`;
            b.style.top = `${p.y - r}px`;
            b.style.width = `${r * 2}px`;
            b.style.height = `${r * 2}px`;
            b.addEventListener('click', () => this.sailTo(t.id));
            this.hotspots.appendChild(b);
        }
        this.drawChart();
    }

    drawChart() {
        const ctx = this.chartCanvas._ctx;
        const size = this.chartCanvas._size;
        if (!ctx) return;
        const world = this.experience.world;
        const boatPos = world && world.boat ? world.boat.getPosition() : { x: SPAWN.x, z: SPAWN.z };
        const f = world && world.boat ? world.boat.forward : { x: 0, z: -1 };
        this.drawBase(ctx, size, { labels: true });
        this.drawDoubloons(ctx, size, boatPos, { all: true });
        this.drawBoat(ctx, size, boatPos, Math.atan2(f.x, -f.z));

        const p = this.progress;
        this.statsEl.innerHTML = `
            <div class="chart-stat"><span class="chart-stat-n">${p.islandsVisited}/5</span><span class="chart-stat-l">Islands</span></div>
            <div class="chart-stat"><span class="chart-stat-n">${p.doubloons}/${DOUBLOON_TOTAL}</span><span class="chart-stat-l">Doubloons</span></div>
            <div class="chart-stat"><span class="chart-stat-n">${p.questsDone}/${QUESTS.length}</span><span class="chart-stat-l">Deeds</span></div>
            <div class="chart-stat"><span class="chart-stat-n">${p.sailTimeLabel}</span><span class="chart-stat-l">At sea</span></div>
        `;
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.isOpen) return;
        if (this.ui && this.ui.gameMenu && this.ui.gameMenu.isOpen) this.ui.gameMenu.close();
        this.isOpen = true;
        document.body.classList.add('chart-open');
        gsap.set(this.chart, { visibility: 'visible' });
        this.layoutChart();
        const sheet = this.chart.querySelector('.chart-sheet');
        gsap.killTweensOf([this.chart, sheet]);
        gsap.fromTo(sheet, { scale: 0.92, y: 20, rotate: -1.5 }, { scale: 1, y: 0, rotate: 0, duration: 0.5, ease: 'back.out(1.3)' });
        gsap.to(this.chart, { opacity: 1, duration: 0.3, ease: 'power2.out' });
        if (this.experience.audio) this.experience.audio.playPanelOpen();
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('chart-open');
        gsap.killTweensOf(this.chart);
        gsap.to(this.chart, {
            opacity: 0, duration: 0.25, ease: 'power2.in',
            onComplete: () => gsap.set(this.chart, { visibility: 'hidden' }),
        });
    }

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
            yaw = Math.atan2(island.dockDir.x, island.dockDir.z);
        }
        world.boat.reset(x, z, yaw);
        if (this.experience.camera) this.experience.camera.frameBehind(yaw);
        this.close();
        if (this.experience.audio) this.experience.audio.playUIClick();
        this.experience.emit('teleport', zoneId);
    }
}
