import gsap from 'gsap';
import Experience from '../Experience.js';

/**
 * In-cove video lightbox. YouTube plays through youtube-nocookie so the
 * visitor never leaves the site (and no cookies are set before they press
 * play). One instance, reused.
 */
let instance = null;

export default class Lightbox {
    static get() {
        if (!instance) instance = new Lightbox();
        return instance;
    }

    constructor() {
        this.experience = Experience.getInstance();
        this.isOpen = false;
        this.build();
    }

    build() {
        this.el = document.createElement('div');
        this.el.id = 'lightbox';
        this.el.innerHTML = `
            <div class="lightbox-backdrop"></div>
            <div class="lightbox-frame parchment">
                <button class="lightbox-close" aria-label="Close">&times;</button>
                <div class="lightbox-video"></div>
                <div class="lightbox-caption">
                    <h4 class="lightbox-title"></h4>
                    <p class="lightbox-desc"></p>
                    <a class="lightbox-ext" target="_blank" rel="noopener">Open on YouTube &rarr;</a>
                </div>
            </div>
        `;
        document.body.appendChild(this.el);
        gsap.set(this.el, { opacity: 0, visibility: 'hidden' });

        this.el.querySelector('.lightbox-backdrop').addEventListener('click', () => this.close());
        this.el.querySelector('.lightbox-close').addEventListener('click', () => this.close());
        window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen) { e.stopPropagation(); this.close(); } }, true);
    }

    /** @param {{id:string, title?:string, desc?:string, start?:number, url?:string}} video */
    open(video) {
        const holder = this.el.querySelector('.lightbox-video');
        const start = video.start ? `&start=${video.start}` : '';
        holder.innerHTML = `<iframe
            src="https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1${start}"
            title="${video.title || 'Video'}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        this.el.querySelector('.lightbox-title').textContent = video.title || '';
        this.el.querySelector('.lightbox-desc').textContent = video.desc || '';
        const ext = this.el.querySelector('.lightbox-ext');
        ext.href = video.url || `https://www.youtube.com/watch?v=${video.id}`;

        this.isOpen = true;
        document.body.classList.add('lightbox-open');
        gsap.killTweensOf(this.el);
        gsap.set(this.el, { visibility: 'visible' });
        gsap.fromTo(this.el, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
        gsap.fromTo(this.el.querySelector('.lightbox-frame'), { scale: 0.94, y: 14 }, { scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.4)' });

        if (this.experience.audio) this.experience.audio.duckMusic(true);
        this.experience.emit('video:play', video.id, video.title);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('lightbox-open');
        gsap.killTweensOf(this.el);
        gsap.to(this.el, {
            opacity: 0, duration: 0.25, ease: 'power2.in',
            onComplete: () => {
                gsap.set(this.el, { visibility: 'hidden' });
                this.el.querySelector('.lightbox-video').innerHTML = '';
            },
        });
        if (this.experience.audio) this.experience.audio.duckMusic(false);
    }
}
