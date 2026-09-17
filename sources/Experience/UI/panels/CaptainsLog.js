import Experience from '../../Experience.js';
import { ISLANDS } from '../../World/layout.js';
import { QUESTS, REWARDS, DOUBLOON_TOTAL } from '../../Utils/Progress.js';

const stamp = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * The Captain's Log: quest journal (deeds, islands, doubloons, secrets) on top
 * of the behind-the-scenes notes. Built fresh each time it opens.
 */
export default function captainsLog() {
    const exp = Experience.getInstance();
    const p = exp.progress;

    const deeds = QUESTS.map((q) => {
        const done = p.hasQuest(q.id);
        const isl = ISLANDS.find((i) => i.id === q.island);
        return `
            <li class="log-entry ${done ? 'is-done' : ''}">
                <span class="log-seal">${done ? '✓' : ''}</span>
                <div class="log-entry-body">
                    <strong>${q.title}</strong>
                    <span class="log-where">${isl ? isl.label : ''}${done ? ` &bull; ${stamp(p.state.quests[q.id])}` : ''}</span>
                    ${done ? '' : `<span class="log-hint">${q.hint}</span>`}
                </div>
            </li>`;
    }).join('');

    const islands = ISLANDS.map((i) => {
        const done = p.hasVisited(i.id);
        return `<span class="tag ${done ? 'tag-done' : 'tag-todo'}">${done ? '✓ ' : ''}${i.label}</span>`;
    }).join('');

    const n = p.doubloons;
    const rewards = REWARDS.map((r) => `
        <li class="log-reward ${n >= r.at ? 'is-done' : ''}">
            <span class="log-reward-at">${r.at}</span>
            <span>${r.title}${n >= r.at ? '' : ` <em>(${r.at - n} more)</em>`}</span>
        </li>`).join('');

    const secrets = Object.keys(p.state.secrets || {});
    const secretsHtml = secrets.length
        ? `<div class="panel-section"><h4>Secrets</h4><div class="panel-tags">${secrets.map((s) => `<span class="tag tag-done">${SECRET_LABELS[s] || s}</span>`).join('')}</div></div>`
        : '';

    return {
        title: "Captain's Log",
        kicker: `${p.questsDone}/${QUESTS.length} deeds &bull; ${p.islandsVisited}/5 islands &bull; ${n}/${DOUBLOON_TOTAL} doubloons`,
        html: `
            <div class="panel-section">
                <h4>Deeds</h4>
                <ul class="log-list">${deeds}</ul>
            </div>

            <div class="panel-section">
                <h4>Islands charted</h4>
                <div class="panel-tags">${islands}</div>
            </div>

            <div class="panel-section">
                <h4>Doubloons &mdash; ${n} / ${DOUBLOON_TOTAL}</h4>
                <p>Gold coins bob along the sailing lanes; a few hide behind the sandbars and by the wreck. The chart hints at the nearest ones.</p>
                <ul class="log-rewards">${rewards}</ul>
            </div>

            ${secretsHtml}

            <div class="panel-section">
                <h4>Time at sea</h4>
                <p>${p.sailTimeLabel} across ${p.state.visits} visit${p.state.visits === 1 ? '' : 's'}.</p>
            </div>

            <div class="panel-section">
                <h4>How this cove was built</h4>
                <p>You're sailing through a hand-built 3D world. No templates, no page builders: code, physics, shaders and a fondness for calm water.</p>
                <div class="panel-tags">
                    <span class="tag">Three.js</span>
                    <span class="tag">Rapier 3D (WASM)</span>
                    <span class="tag">GLSL</span>
                    <span class="tag">Vite</span>
                    <span class="tag">GSAP</span>
                    <span class="tag">Howler.js</span>
                </div>
            </div>

            <div class="panel-section">
                <h4>The water</h4>
                <p>The sea is a sum of four Gerstner waves evaluated in a vertex shader. The very same wave function runs on the CPU to float the boat, the barrels and the buoys, so what you see is what you sail on. Reflections come from a second, mirrored render each frame; foam and shallows from a baked distance-to-shore field.</p>
            </div>

            <div class="panel-section">
                <h4>Crew</h4>
                <div class="panel-tags">
                    <span class="tag">Claude</span>
                    <span class="tag">Cursor</span>
                    <span class="tag">Kenney Pirate Kit (CC0)</span>
                </div>
                <p class="panel-footnote-inline">AI helped write and debug; every system was reviewed, tuned and sailed by hand. Music and sound effects are synthesised in code.</p>
            </div>

            <div class="panel-section">
                <p class="panel-quote">"A portfolio should be somewhere you want to spend time."</p>
            </div>
        `,
    };
}

const SECRET_LABELS = {
    kraken: 'Something in the deep',
    bottle: 'Message in a bottle',
    whale: 'The night whale',
    dolphins: 'Dolphin escort',
    merchant: 'Hailed the merchant',
};
