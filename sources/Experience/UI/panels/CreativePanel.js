import Experience from '../../Experience.js';
import Lightbox from '../Lightbox.js';

/**
 * Creative reel. `id` is the YouTube id; thumbnails come straight from
 * i.ytimg.com so there is nothing to host. `start` = seconds offset.
 */
export const VIDEOS = [
    { group: 'Projection mapping', id: 'F58rJUxnpZ4', title: 'XR Dome', desc: '360° projection dome for Intel and the kids of Southern Israel' },
    { group: 'Projection mapping', id: 'm0lJE7ubgmU', start: 137, title: 'Beit Herzel', desc: '3D projection mapping on Beit Herzel at Hulda Forest' },
    { group: 'Projection mapping', id: 'k-5wwCOuT1E', title: 'The Dress', desc: '8-metre diameter dress projection mapping' },
    { group: 'Projection mapping', id: 'vBmGXVHEyjE', title: 'Eldad Zitrin Live', desc: 'Live projection mapping at Sitria' },

    { group: 'Short films', id: 'ycy5WTETkss', title: 'My Girl', desc: 'Experimental short film' },
    { group: 'Short films', id: 'B5RvsAgNhuQ', title: 'Four Point Something Seconds', desc: 'The escalating process of living on the edge' },
    { group: 'Short films', id: '93_Z17oB5Ks', title: 'PaperCut', desc: 'The looped life of a misunderstood man' },

    { group: 'Commercial & music', id: 'br7YP-E1f3Y', title: 'Eden Alene — Set Me Free', desc: 'Eurovision Song Contest music video' },
    { group: 'Commercial & music', id: 'T2YcnsDmyGM', title: 'The Idan Raichel Project', desc: 'With Nasrin Kadri' },
    { group: 'Commercial & music', id: 'Kg6llG9NEaU', title: 'Kol HaShchoona, Kan 11', desc: 'Broadcast work for Kan 11', url: 'https://www.youtube.com/watch?v=Kg6llG9NEaU&list=PLLttfoK87AdW80mtWj6BtBsDWN0f8wCKI&index=3' },
    { group: 'Commercial & music', id: 'xGfdsqyLeJ4', title: 'TAU Innovation', desc: 'Conference video invitation' },
];

export const REEL_URL = 'https://vimeo.com/morethanvideos';

export const thumbUrl = (id, q = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const videoCard = (v) => `
    <button class="creative-card" data-id="${v.id}" type="button" aria-label="Play ${esc(v.title)}">
        <span class="creative-thumb">
            <img src="${thumbUrl(v.id)}" alt="" loading="lazy" decoding="async" width="480" height="360">
            <span class="creative-play"></span>
        </span>
        <span class="creative-meta">
            <h5>${esc(v.title)}</h5>
            <p>${esc(v.desc)}</p>
        </span>
    </button>`;

const groups = [...new Set(VIDEOS.map((v) => v.group))];

export default {
    title: 'Lantern Bay',
    kicker: 'Creative — video art & production',
    html: `
        <div class="panel-section">
            <h3>Video Art &amp; Production</h3>
            <p>A decade of bringing artistic visions to life, from projection mapping installations to short films and commercial work. Everything plays right here in the bay.</p>
        </div>

        ${groups.map((g) => `
        <div class="panel-section">
            <h4>${esc(g)}</h4>
            <div class="creative-grid">
                ${VIDEOS.filter((v) => v.group === g).map(videoCard).join('')}
            </div>
        </div>`).join('')}

        <div class="panel-section">
            <a href="${REEL_URL}" target="_blank" rel="noopener" class="contact-btn contact-btn-wide">
                <span class="contact-icon">&#9654;</span>
                <span>Commercial reel — More Than Videos on Vimeo</span>
            </a>
        </div>
    `,

    mount(root) {
        const exp = Experience.getInstance();
        const onClick = (e) => {
            const card = e.target.closest('.creative-card[data-id]');
            if (!card) return;
            const v = VIDEOS.find((x) => x.id === card.dataset.id);
            if (!v) return;
            Lightbox.get().open(v);
            if (exp.audio) exp.audio.playUIClick();
        };
        root.addEventListener('click', onClick);
        return () => root.removeEventListener('click', onClick);
    },
};
