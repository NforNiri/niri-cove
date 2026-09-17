import { track } from '@vercel/analytics';
import Experience from '../Experience.js';
import { ISLANDS } from '../World/layout.js';

/**
 * Custom engagement events so time-on-site can be measured and improved.
 *
 * Providers (all optional, all fire from the same `event()` call):
 *  - Vercel Web Analytics custom events (`track`; needs a Pro plan, silently
 *    dropped on Hobby)
 *  - Plausible: set VITE_PLAUSIBLE_DOMAIN (and VITE_PLAUSIBLE_SRC for a
 *    self-hosted script) and the snippet is injected here
 *  - Umami: set VITE_UMAMI_SRC and VITE_UMAMI_ID
 *  - PostHog or anything else already on `window` (posthog.capture)
 *
 * KPIs and the events that feed them:
 *  - Avg session length       session_milestone (30s/2m/5m/10m/20m), session
 *  - Islands per session      zone_enter.islands, session.islands
 *  - Completion rate          islands_complete / launch, deeds_complete / launch,
 *                             commendation / launch
 *  - Quality tier split       launch.quality, quality
 *  - Content engagement       video_play, work_expand, outbound, resume_download
 */
const MILESTONES_S = [30, 120, 300, 600, 1200];

export default class Analytics {
    constructor() {
        this.experience = Experience.getInstance();
        this.start = performance.now();
        this.islandsThisSession = new Set();
        this.sent = new Set();
        this.dev = !!import.meta.env?.DEV;
        this.milestoneIndex = 0;

        this.injectProviders();
        this.bind();
    }

    /** Drop in a free provider from env vars, so no code change is needed to switch. */
    injectProviders() {
        const env = import.meta.env || {};
        const add = (attrs) => {
            const s = document.createElement('script');
            s.defer = true;
            Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
            document.head.appendChild(s);
        };
        if (env.VITE_PLAUSIBLE_DOMAIN) {
            // The .manual.js variant records SPA-less pageviews once and allows custom props
            window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
            add({ src: env.VITE_PLAUSIBLE_SRC || 'https://plausible.io/js/script.tagged-events.js', 'data-domain': env.VITE_PLAUSIBLE_DOMAIN });
        }
        if (env.VITE_UMAMI_SRC && env.VITE_UMAMI_ID) {
            add({ src: env.VITE_UMAMI_SRC, 'data-website-id': env.VITE_UMAMI_ID });
        }
    }

    bind() {
        const exp = this.experience;
        exp.on('launched', () => {
            this.event('launch', {
                quality: exp.renderer ? exp.renderer.quality : 'n/a',
                returning: exp.progress ? exp.progress.returning : false,
                mobile: exp.controls ? exp.controls.isMobile : false,
                visits: exp.progress ? exp.progress.state.visits : 1,
            });
            this.startMilestones();
        });
        exp.on('intro:done', () => this.event('intro_done', { skipped: exp.camera ? !!exp.camera.introSkipped : undefined }));
        exp.on('zone:enter', (id) => {
            this.islandsThisSession.add(id);
            this.event('zone_enter', { zone: id, islands: this.islandsThisSession.size });
        });
        exp.on('progress:island', () => {
            const p = exp.progress;
            if (p && p.islandsVisited >= ISLANDS.length) this.event('islands_complete', { seconds: this.seconds() }, { once: 'islands_complete' });
        });
        exp.on('progress:doubloon', (id, count) => this.event('doubloon', { id, count }));
        exp.on('progress:quest', (id) => {
            this.event('quest', { id });
            const p = exp.progress;
            if (p && p.questsDone >= 5) this.event('deeds_complete', { seconds: this.seconds() }, { once: 'deeds_complete' });
        });
        exp.on('progress:unlock', (r) => this.event('unlock', { reward: r.id }));
        exp.on('progress:secret', (id) => this.event('secret', { id }));
        exp.on('commendation', (how) => this.event('commendation', { how, seconds: this.seconds() }));
        exp.on('teleport', (zone) => this.event('teleport', { zone }));
        exp.on('quality:change', (q) => this.event('quality', { tier: q }));
        exp.on('panel:link', (href) => this.event('outbound', { href }));
        exp.on('panel:track', (what) => this.event(what));
        exp.on('video:play', (id, title) => this.event('video_play', { id, title }));
        exp.on('work:filter', (filter, shown) => this.event('work_filter', { filter, shown }));
        exp.on('work:expand', (name) => this.event('work_expand', { name }));
        exp.on('weather:squall', () => this.event('squall'));
        exp.on('event:bottle', (title) => this.event('bottle', { title }));
        exp.on('event:dolphins', () => this.event('dolphins'));
        exp.on('event:whale', () => this.event('whale'));
        exp.on('event:kraken', () => this.event('kraken'));

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.sessionEnd();
        });
        window.addEventListener('pagehide', () => this.sessionEnd());
    }

    seconds() { return Math.round((performance.now() - this.start) / 1000); }

    /**
     * Live session-length milestones. pagehide is unreliable on mobile, so
     * these fire while the tab is open and give a survival curve directly.
     */
    startMilestones() {
        const tick = () => {
            if (document.visibilityState === 'hidden') return;
            const s = this.seconds();
            while (this.milestoneIndex < MILESTONES_S.length && s >= MILESTONES_S[this.milestoneIndex]) {
                const m = MILESTONES_S[this.milestoneIndex++];
                this.event('session_milestone', {
                    at: m >= 60 ? `${m / 60}m` : `${m}s`,
                    islands: this.islandsThisSession.size,
                    doubloons: this.experience.progress ? this.experience.progress.doubloons : 0,
                });
            }
        };
        this.milestoneTimer = setInterval(tick, 5000);
    }

    sessionEnd() {
        const seconds = this.seconds();
        const bucket = seconds < 30 ? '<30s' : seconds < 120 ? '30s-2m' : seconds < 300 ? '2-5m' : seconds < 600 ? '5-10m' : '10m+';
        // Only once per bucket per hide
        this.event('session', { seconds, bucket, islands: this.islandsThisSession.size,
            doubloons: this.experience.progress ? this.experience.progress.doubloons : 0 }, { once: 'session-' + bucket });
    }

    event(name, props = {}, { once = null } = {}) {
        if (once) {
            if (this.sent.has(once)) return;
            this.sent.add(once);
        }
        if (this.dev) console.debug('[analytics]', name, props);
        try { track(name, props); } catch (e) { /* not on Vercel */ }
        try {
            if (typeof window.plausible === 'function') window.plausible(name, { props });
            if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, props);
            if (window.posthog && typeof window.posthog.capture === 'function') window.posthog.capture(name, props);
        } catch (e) { /* ignore third-party failures */ }
    }
}
