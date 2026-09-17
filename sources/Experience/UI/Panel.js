import gsap from 'gsap';
import Experience from '../Experience.js';

export default class Panel {
    constructor() {
        this.experience = Experience.getInstance();
        this.isVisible = false;
        this.currentZone = null;
        this.createElement();
    }

    createElement() {
        this.element = document.createElement('aside');
        this.element.id = 'panel';
        this.element.innerHTML = `
            <div class="panel-rope"></div>
            <button class="panel-close" aria-label="Close">&times;</button>
            <header class="panel-header">
                <p class="panel-kicker"></p>
                <h2 class="panel-title"></h2>
            </header>
            <div class="panel-content"></div>
        `;
        document.body.appendChild(this.element);

        this.element.querySelector('.panel-close').addEventListener('click', () => this.hide());

        gsap.set(this.element, { x: '100%', opacity: 0 });
    }

    show(zoneId, content) {
        if (this.currentZone === zoneId && this.isVisible) return;

        // Let the previous content release listeners/timers
        if (this.unmount) { try { this.unmount(); } catch (e) { /* noop */ } this.unmount = null; }

        this.currentZone = zoneId;
        this.element.querySelector('.panel-title').textContent = content.title;
        this.element.querySelector('.panel-kicker').innerHTML = content.kicker || '';
        const contentEl = this.element.querySelector('.panel-content');
        contentEl.innerHTML = content.html;
        contentEl.scrollTop = 0;
        if (typeof content.mount === 'function') this.unmount = content.mount(contentEl, this) || null;

        const wasVisible = this.isVisible;
        this.element.style.display = 'flex';
        this.isVisible = true;
        document.body.classList.add('panel-open');

        if (this.experience.audio) this.experience.audio.playPanelOpen();

        gsap.killTweensOf(this.element);
        if (wasVisible) {
            gsap.set(this.element, { x: '0%', opacity: 1, clipPath: 'inset(0 0 0% 0)' });
        } else {
            // Parchment unroll: slide in, then the sheet drops open from the rod
            gsap.set(this.element, { x: '6%', opacity: 1, clipPath: 'inset(0 0 100% 0)' });
            gsap.to(this.element, { x: '0%', duration: 0.5, ease: 'power3.out' });
            gsap.to(this.element, { clipPath: 'inset(0 0 0% 0)', duration: 0.7, ease: 'power3.inOut' });
        }

        const children = contentEl.children;
        if (children.length) {
            gsap.fromTo(children,
                { y: 18, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, delay: wasVisible ? 0.05 : 0.3, ease: 'power2.out' }
            );
        }
    }

    hide() {
        if (!this.isVisible) return;
        this.isVisible = false;

        gsap.killTweensOf(this.element);
        gsap.to(this.element, {
            x: '100%',
            opacity: 0,
            duration: 0.4,
            ease: 'power3.in',
            onComplete: () => {
                this.element.style.display = 'none';
                this.currentZone = null;
                document.body.classList.remove('panel-open');
                if (this.unmount) { try { this.unmount(); } catch (e) { /* noop */ } this.unmount = null; }
            },
        });
    }
}
