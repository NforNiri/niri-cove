import { track } from '@vercel/analytics';
import Experience from '../Experience.js';

/**
 * Custom engagement events so time-on-site can be measured and improved.
 *
 * Sends to Vercel Web Analytics custom events (`track`, needs a Pro plan; on
 * Hobby they are silently dropped) and, when present, to a Plausible / Umami /
 * PostHog snippet (`window.plausible`, `window.umami`, `window.posthog`), so a
 * free provider can be dropped into index.html without touching this file.
 *
 * KPIs these feed: avg session length, islands per session, completion rate,
 * quality tier split.
 */
export default class Analytics {
    constructor() {
        this.experience = Experience.getInstance();
        this.start = performance.now();
        this.islandsThisSession = new Set();
        this.sent = new Set();
        this.dev = !!import.meta.env?.DEV;

        this.bind();
    }

    bind() {
        const exp = this.experience;
        exp.on('launched', () => {
            this.event('launch', {
                quality: exp.renderer ? exp.renderer.quality : 'n/a',
                returning: exp.progress ? exp.progress.returning : false,
                mobile: exp.controls ? exp.controls.isMobile : false,
            });
        });
        exp.on('intro:done', () => this.event('intro_done'));
        exp.on('zone:enter', (id) => {
            this.islandsThisSession.add(id);
            this.event('zone_enter', { zone: id, islands: this.islandsThisSession.size });
        });
        exp.on('progress:doubloon', (id, count) => this.event('doubloon', { id, count }));
        exp.on('progress:quest', (id) => this.event('quest', { id }));
        exp.on('progress:unlock', (r) => this.event('unlock', { reward: r.id }));
        exp.on('progress:secret', (id) => this.event('secret', { id }));
        exp.on('commendation', (how) => this.event('commendation', { how }));
        exp.on('teleport', (zone) => this.event('teleport', { zone }));
        exp.on('quality:change', (q) => this.event('quality', { tier: q }));
        exp.on('panel:link', (href) => this.event('outbound', { href }));
        exp.on('panel:track', (what) => this.event(what));
        exp.on('video:play', (id, title) => this.event('video_play', { id, title }));
        exp.on('work:filter', (filter, shown) => this.event('work_filter', { filter, shown }));
        exp.on('work:expand', (name) => this.event('work_expand', { name }));

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.sessionEnd();
        });
        window.addEventListener('pagehide', () => this.sessionEnd());
    }

    sessionEnd() {
        const seconds = Math.round((performance.now() - this.start) / 1000);
        const bucket = seconds < 30 ? '<30s' : seconds < 120 ? '30s-2m' : seconds < 300 ? '2-5m' : seconds < 600 ? '5-10m' : '10m+';
        // Only once per hide
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
