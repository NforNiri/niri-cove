import * as THREE from 'three';

/**
 * A CanvasTexture that crossfades through a list of images: the "reel" on the
 * Lantern Bay screen and the billboard at the Shipyard. Images load lazily and
 * with CORS so they can be uploaded to WebGL; failures are skipped.
 *
 * Cheap by design: the canvas is only redrawn while a crossfade is running,
 * and only when `enabled` (HIGH tier) is true.
 */
export default class Slideshow {
    /**
     * @param {string[]} urls
     * @param {{width?:number, height?:number, hold?:number, fade?:number, fit?:'cover'|'contain', tint?:string}} opts
     */
    constructor(urls, { width = 512, height = 320, hold = 4.5, fade = 0.9, fit = 'cover', tint = null } = {}) {
        this.urls = urls;
        this.hold = hold;
        this.fade = fade;
        this.fit = fit;
        this.tint = tint;

        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, width, height);

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.generateMipmaps = false;

        this.images = [];
        this.index = -1;
        this.next = 0;
        this.t = 0;
        this.enabled = true;
        this.ready = false;
        this.dirty = true;

        this.loadAll();
    }

    loadAll() {
        let first = true;
        for (const url of this.urls) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.decoding = 'async';
            img.onload = () => {
                this.images.push(img);
                if (first) {
                    first = false;
                    this.ready = true;
                    this.index = 0;
                    this.t = 0;
                    this.draw(1);
                }
            };
            img.onerror = () => { /* skip */ };
            img.src = url;
        }
    }

    drawImage(img, alpha) {
        const { width: W, height: H } = this.canvas;
        const ctx = this.ctx;
        const s = this.fit === 'cover'
            ? Math.max(W / img.naturalWidth, H / img.naturalHeight)
            : Math.min(W / img.naturalWidth, H / img.naturalHeight);
        const w = img.naturalWidth * s;
        const h = img.naturalHeight * s;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        ctx.globalAlpha = 1;
    }

    /** @param {number} mix 0..1 progress of the fade from current to next */
    draw(mix) {
        const cur = this.images[this.index];
        if (!cur) return;
        const ctx = this.ctx;
        ctx.fillStyle = '#0B0F10';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawImage(cur, 1);
        const nxt = this.images[this.nextIndex()];
        if (mix > 0 && nxt && nxt !== cur) this.drawImage(nxt, mix);
        if (this.tint) {
            ctx.fillStyle = this.tint;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.texture.needsUpdate = true;
    }

    nextIndex() {
        return this.images.length ? (this.index + 1) % this.images.length : 0;
    }

    /** @param {number} dt seconds */
    update(dt) {
        if (!this.enabled || !this.ready || this.images.length < 2) return;
        this.t += dt;
        if (this.t < this.hold) return;
        const k = (this.t - this.hold) / this.fade;
        if (k >= 1) {
            this.index = this.nextIndex();
            this.t = 0;
            this.draw(0);
        } else {
            // ease in-out for a projector-like dissolve
            this.draw(k * k * (3 - 2 * k));
        }
    }

    dispose() {
        this.texture.dispose();
        this.images.length = 0;
    }
}
