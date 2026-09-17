import gsap from 'gsap';
import Experience from '../Experience.js';
import { DOUBLOON_TOTAL, QUESTS } from '../Utils/Progress.js';

const W = 1200;
const H = 630;
const PORTFOLIO = 'https://niri-portfolio.vercel.app/';
const LINKEDIN = 'https://www.linkedin.com/in/niri-levy-36664791/';

/**
 * Captain's Commendation: a shareable PNG card rendered on a canvas with the
 * visitor's stats, offered when the last doubloon is found (and any time after
 * from the Chart menu).
 */
export default class Commendation {
    constructor(ui) {
        this.experience = Experience.getInstance();
        this.progress = this.experience.progress;
        this.ui = ui;
        this.isOpen = false;
        this.createElement();
    }

    createElement() {
        this.el = document.createElement('div');
        this.el.id = 'commendation';
        this.el.innerHTML = `
            <div class="chart-backdrop"></div>
            <div class="commendation-sheet parchment">
                <button class="chart-close" aria-label="Close">&times;</button>
                <p class="chart-eyebrow">By order of the Cove</p>
                <h2 class="chart-title">Captain's Commendation</h2>
                <canvas class="commendation-canvas"></canvas>
                <p class="commendation-text"></p>
                <div class="commendation-actions">
                    <button class="contact-btn" data-act="download">Download the card</button>
                    <button class="contact-btn" data-act="share">Share</button>
                    <a class="contact-btn" href="${PORTFOLIO}" target="_blank" rel="noopener">Visit the main portfolio</a>
                    <a class="contact-btn" href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a>
                </div>
            </div>
        `;
        document.body.appendChild(this.el);
        gsap.set(this.el, { opacity: 0, visibility: 'hidden' });

        this.canvas = this.el.querySelector('.commendation-canvas');
        this.canvas.width = W;
        this.canvas.height = H;

        this.el.querySelector('.chart-close').addEventListener('click', () => this.close());
        this.el.querySelector('.chart-backdrop').addEventListener('click', () => this.close());
        this.el.querySelector('[data-act="download"]').addEventListener('click', () => this.download());
        this.el.querySelector('[data-act="share"]').addEventListener('click', () => this.share());
        window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) this.close(); });
    }

    // ── Card drawing ─────────────────────────────────────────────────────

    draw() {
        const ctx = this.canvas.getContext('2d');
        const p = this.progress;

        // Parchment
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#F3E6C4');
        g.addColorStop(0.5, '#EAD8B1');
        g.addColorStop(1, '#DCC28C');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // Fibre noise
        ctx.globalAlpha = 0.06;
        for (let i = 0; i < 2400; i++) {
            ctx.fillStyle = i % 2 ? '#5A3A1E' : '#FFFFFF';
            ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1);
        }
        ctx.globalAlpha = 1;
        // Vignette
        const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
        v.addColorStop(0, 'rgba(90,58,30,0)');
        v.addColorStop(1, 'rgba(90,58,30,0.35)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, W, H);

        // Border
        ctx.strokeStyle = '#8B5A2B';
        ctx.lineWidth = 6;
        ctx.strokeRect(28, 28, W - 56, H - 56);
        ctx.lineWidth = 2;
        ctx.strokeRect(44, 44, W - 88, H - 88);

        // Text
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(30,42,43,0.7)';
        ctx.font = '600 20px Cinzel, serif';
        ctx.fillText('N I R I \' S   C O V E', W / 2, 105);

        ctx.fillStyle = '#1E2A2B';
        ctx.font = '84px "Pirata One", Cinzel, serif';
        ctx.fillText("Captain's Commendation", W / 2, 195);

        ctx.font = '400 22px Nunito, sans-serif';
        ctx.fillStyle = 'rgba(30,42,43,0.85)';
        ctx.fillText('Awarded to the Captain who charted every island and recovered every doubloon', W / 2, 245);

        // Stats
        const stats = [
            [`${p.islandsVisited}/5`, 'ISLANDS'],
            [`${p.doubloons}/${DOUBLOON_TOTAL}`, 'DOUBLOONS'],
            [`${p.questsDone}/${QUESTS.length}`, 'DEEDS'],
            [p.sailTimeLabel, 'AT SEA'],
        ];
        const bw = 220;
        const x0 = W / 2 - (stats.length * bw) / 2 + bw / 2;
        stats.forEach(([n, l], i) => {
            const x = x0 + i * bw;
            ctx.strokeStyle = 'rgba(139,90,43,0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x - 90, 290, 180, 110, 10);
            ctx.stroke();
            ctx.fillStyle = '#B3322E';
            ctx.font = '48px "Pirata One", Cinzel, serif';
            ctx.fillText(n, x, 348);
            ctx.fillStyle = 'rgba(30,42,43,0.65)';
            ctx.font = '700 13px Cinzel, serif';
            ctx.fillText(l, x, 380);
        });

        // Wax seal
        const sx = W - 170, sy = H - 150;
        ctx.fillStyle = '#B3322E';
        ctx.beginPath();
        ctx.arc(sx, sy, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8E2622';
        ctx.beginPath();
        ctx.arc(sx, sy, 46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F2D9B3';
        ctx.font = '54px "Pirata One", Cinzel, serif';
        ctx.fillText('N', sx, sy + 20);

        // Footer
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(30,42,43,0.8)';
        ctx.font = '600 18px Cinzel, serif';
        const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        ctx.fillText(`Signed at the Lagoon, ${date}`, 80, H - 150);
        ctx.font = '400 20px Nunito, sans-serif';
        ctx.fillText('Niri Levy — Head of Creative & PMO', 80, H - 115);
        ctx.fillStyle = '#137C8B';
        ctx.fillText('niri-portfolio.vercel.app', 80, H - 84);
    }

    async ensureFonts() {
        if (!document.fonts) return;
        try {
            await Promise.all([
                document.fonts.load('84px "Pirata One"'),
                document.fonts.load('600 20px Cinzel'),
                document.fonts.load('400 20px Nunito'),
            ]);
        } catch (e) { /* fall back to system fonts */ }
    }

    // ── Modal ────────────────────────────────────────────────────────────

    async open() {
        if (this.isOpen) return;
        this.isOpen = true;
        if (this.ui.gameMenu && this.ui.gameMenu.isOpen) this.ui.gameMenu.close();
        if (this.ui.treasureMap && this.ui.treasureMap.isOpen) this.ui.treasureMap.close();
        await this.ensureFonts();
        this.draw();
        this.progress.markCommendationSeen();

        const shareBtn = this.el.querySelector('[data-act="share"]');
        shareBtn.style.display = navigator.share ? '' : 'none';

        const done = this.progress.complete;
        this.el.querySelector('.commendation-text').textContent = done
            ? 'Every doubloon recovered. The golden sail is yours. Thank you for spending time in my cove — if you enjoyed the voyage, the main portfolio has the full story.'
            : `You have recovered ${this.progress.doubloons} of ${DOUBLOON_TOTAL} doubloons so far. Find them all for the golden sail.`;

        document.body.classList.add('chart-open');
        gsap.set(this.el, { visibility: 'visible' });
        const sheet = this.el.querySelector('.commendation-sheet');
        gsap.killTweensOf([this.el, sheet]);
        gsap.fromTo(sheet, { scale: 0.9, y: 24 }, { scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.3)' });
        gsap.to(this.el, { opacity: 1, duration: 0.35 });
        if (this.experience.audio) this.experience.audio.playQuest();
        this.experience.emit('commendation', 'open');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('chart-open');
        gsap.to(this.el, {
            opacity: 0, duration: 0.25,
            onComplete: () => gsap.set(this.el, { visibility: 'hidden' }),
        });
    }

    download() {
        const a = document.createElement('a');
        a.download = 'niris-cove-commendation.png';
        a.href = this.canvas.toDataURL('image/png');
        a.click();
        this.experience.emit('commendation', 'download');
    }

    async share() {
        try {
            const blob = await new Promise((r) => this.canvas.toBlob(r, 'image/png'));
            const file = new File([blob], 'niris-cove-commendation.png', { type: 'image/png' });
            const data = {
                title: "Captain's Commendation — Niri's Cove",
                text: `I charted every island in Niri's Cove. ${PORTFOLIO}`,
                url: window.location.origin,
            };
            if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
            await navigator.share(data);
            this.experience.emit('commendation', 'share');
        } catch (e) { /* user cancelled */ }
    }
}
