import Experience from '../../Experience.js';
import { PROJECTS, FILTERS } from './projects.js';

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const card = (p, i) => {
    const tags = p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    const thumb = p.slug
        ? `<img class="project-thumb" src="/thumbs/${p.slug}.jpg" alt="" loading="lazy" decoding="async" width="640" height="400">`
        : `<div class="project-thumb project-thumb-blank"><span>${initials(p.name)}</span></div>`;
    const hasDetail = p.role || p.challenge || p.outcome;
    const detail = hasDetail ? `
        <div class="project-detail">
            ${p.role ? `<div class="project-detail-row"><span class="project-detail-k">Role</span><span>${esc(p.role)}</span></div>` : ''}
            ${p.challenge ? `<div class="project-detail-row"><span class="project-detail-k">Challenge</span><span>${esc(p.challenge)}</span></div>` : ''}
            ${p.outcome ? `<div class="project-detail-row"><span class="project-detail-k">Outcome</span><span>${esc(p.outcome)}</span></div>` : ''}
            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" class="project-visit">Visit the site &rarr;</a>` : ''}
        </div>` : '';
    return `
        <article class="project-card" data-tags="${esc(p.tags.join('|'))}" data-i="${i}" ${hasDetail ? 'tabindex="0" role="button" aria-expanded="false"' : ''}>
            <div class="project-thumb-wrap">${thumb}</div>
            <div class="project-body">
                <h4>${esc(p.name)}</h4>
                <p class="project-what">${esc(p.what)}</p>
                <div class="panel-tags">${tags}</div>
            </div>
            ${detail}
        </article>`;
};

const chips = FILTERS.map((f, i) => `<button class="filter-chip ${i === 0 ? 'is-active' : ''}" data-filter="${esc(f.id)}">${esc(f.label)}</button>`).join('');

export default {
    title: 'The Shipyard',
    kicker: 'Work — web, product & AI-assisted delivery',
    html: `
        <div class="panel-section">
            <p>Case studies across creative direction, project and product management: websites, platforms and campaigns I owned from brief and scoping through production, QA and launch.</p>
        </div>

        <div class="panel-section">
            <div class="panel-h-row">
                <h4>Ships launched</h4>
                <span class="project-count">${PROJECTS.length} voyages</span>
            </div>
            <div class="filter-chips">${chips}</div>
            <div class="project-grid">
                ${PROJECTS.map(card).join('')}
            </div>
        </div>

        <div class="panel-section">
            <h4>How I run the yard</h4>
            <p>End-to-end ownership: cross-functional crews, client relationships, budgets and timelines. Generative AI sits inside the production pipeline, not beside it, for concepting, assets, copy and code. This cove is a small example: Three.js, Rapier physics and custom GLSL water, built with Claude and Cursor as coding partners.</p>
            <div class="panel-tags" style="margin-top: 10px;">
                <span class="tag">Creative Direction</span>
                <span class="tag">Project Management</span>
                <span class="tag">Product Management</span>
                <span class="tag">Analytics</span>
                <span class="tag">Gen-AI Pipelines</span>
            </div>
        </div>

        <div class="panel-section">
            <h4>Tools in the hold</h4>
            <div class="ai-tools">
                <div class="ai-tool">
                    <span class="ai-tool-name">Claude &amp; Cursor</span>
                    <span class="ai-tool-desc">Coding partners and strategic thinking</span>
                </div>
                <div class="ai-tool">
                    <span class="ai-tool-name">Midjourney</span>
                    <span class="ai-tool-desc">Visual concepting and art direction</span>
                </div>
                <div class="ai-tool">
                    <span class="ai-tool-name">Meshy AI</span>
                    <span class="ai-tool-desc">Text-to-3D model generation</span>
                </div>
                <div class="ai-tool">
                    <span class="ai-tool-name">ElevenLabs</span>
                    <span class="ai-tool-desc">Voice, audio and sound design</span>
                </div>
            </div>
        </div>
    `,

    /** Filters, expand/collapse and hover parallax. Returns an unmount fn. */
    mount(root) {
        const exp = Experience.getInstance();
        const grid = root.querySelector('.project-grid');
        const cards = [...root.querySelectorAll('.project-card')];
        const chipEls = [...root.querySelectorAll('.filter-chip')];

        const applyFilter = (id) => {
            for (const c of chipEls) c.classList.toggle('is-active', c.dataset.filter === id);
            let shown = 0;
            for (const card of cards) {
                const on = id === 'all' || card.dataset.tags.split('|').includes(id);
                card.classList.toggle('is-hidden', !on);
                if (on) shown++;
            }
            grid.classList.toggle('is-filtered', id !== 'all');
            exp.emit('work:filter', id, shown);
        };
        const onChip = (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;
            applyFilter(chip.dataset.filter);
            if (exp.audio) exp.audio.playUIClick();
        };

        const toggle = (card) => {
            const open = !card.classList.contains('is-open');
            for (const c of cards) { c.classList.remove('is-open'); c.setAttribute('aria-expanded', 'false'); }
            if (open) {
                card.classList.add('is-open');
                card.setAttribute('aria-expanded', 'true');
                exp.emit('work:expand', PROJECTS[+card.dataset.i]?.name);
                if (exp.audio) exp.audio.playUIClick();
                requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
            }
        };
        const onGridClick = (e) => {
            if (e.target.closest('a')) return; // let links be links
            const card = e.target.closest('.project-card[role="button"]');
            if (card) toggle(card);
        };
        const onGridKey = (e) => {
            if (e.code !== 'Enter' && e.code !== 'Space') return;
            const card = e.target.closest('.project-card[role="button"]');
            if (!card) return;
            e.preventDefault();
            toggle(card);
        };

        // Hover parallax on the thumbnail (pointer devices only)
        const fine = window.matchMedia('(pointer: fine)').matches;
        const onMove = (e) => {
            const card = e.target.closest('.project-card');
            if (!card) return;
            const img = card.querySelector('.project-thumb');
            if (!img) return;
            const r = card.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width - 0.5;
            const ny = (e.clientY - r.top) / r.height - 0.5;
            img.style.transform = `scale(1.08) translate(${-nx * 8}px, ${-ny * 8}px)`;
        };
        const onLeave = (e) => {
            const card = e.target.closest('.project-card');
            const img = card && card.querySelector('.project-thumb');
            if (img) img.style.transform = '';
        };

        root.addEventListener('click', onChip);
        grid.addEventListener('click', onGridClick);
        grid.addEventListener('keydown', onGridKey);
        if (fine) {
            grid.addEventListener('pointermove', onMove);
            grid.addEventListener('pointerout', onLeave);
        }

        return () => {
            root.removeEventListener('click', onChip);
            grid.removeEventListener('click', onGridClick);
            grid.removeEventListener('keydown', onGridKey);
            grid.removeEventListener('pointermove', onMove);
            grid.removeEventListener('pointerout', onLeave);
        };
    },
};
