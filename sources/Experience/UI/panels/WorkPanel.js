const CD = 'Creative Direction';
const PM = 'Project Management';

// Mirrors the Selected Work grid on niri-portfolio.vercel.app
const PROJECTS = [
    { name: 'Localz', url: 'https://localz-group.com/', tags: [CD, PM] },
    { name: 'A&amp;D', url: 'https://and-law.co.il/', tags: [CD, PM] },
    { name: 'Tictruck', url: 'https://www.tictruck.co.il/', tags: [PM] },
    { name: 'Simplex3d', url: 'https://www.simplex3d.com/', tags: ['Product Management', 'Analytics'] },
    { name: 'Daniel Matat Jewelry', url: 'https://woocommerce-1142719-5529229.cloudwaysapps.com/', tags: [PM] },
    { name: 'LPI Fire', url: 'https://lpifire.com/', tags: [PM] },
    { name: 'Dr Tal Rapaport', url: 'https://coreandcode.co.il/web/tal-rappaport/index.html', tags: [PM] },
    { name: 'Podcastia', url: 'https://podcastiya.co.il/', tags: [PM] },
    { name: 'Rakafot', url: 'https://rakafot.org.il/', tags: [CD, PM] },
    { name: 'Force Media', url: 'https://forcemedia.co.il/', tags: [PM] },
    { name: 'SparkingAI', url: 'https://www.sparking.ai/', tags: [CD, PM] },
    { name: 'Justi', url: 'https://www.justi.co.il/', tags: [CD, PM] },
    { name: 'Play and more', url: null, tags: [PM] },
    { name: 'Mophet', url: 'https://www.mophet.com/', tags: [PM] },
    { name: 'Shir Meidan', url: 'https://shirmeidan.com/', tags: [PM] },
    { name: 'Proxi', url: 'https://proxi.co.il/', tags: [CD, PM] },
    { name: 'Tagiz', url: 'https://tagiz.com/', tags: [PM] },
    { name: 'Veriix', url: 'https://veriix.net/', tags: [PM] },
    { name: 'Mum Wood', url: 'https://mumwood.co.il/', tags: [PM] },
    { name: 'Pool &amp; Reef', url: 'https://pool-reef.co.il/', tags: [CD, PM] },
    { name: 'Casinofy', url: 'https://www.casinofy.com/', tags: [PM] },
    { name: 'Artemis', url: 'https://artemis-diamonds.co.il/', tags: [PM] },
];

const card = (p) => {
    const tags = p.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    const inner = `<h4>${p.name}</h4><div class="panel-tags">${tags}</div>`;
    return p.url
        ? `<a href="${p.url}" target="_blank" rel="noopener" class="project-card">${inner}</a>`
        : `<div class="project-card project-card-static">${inner}</div>`;
};

export default {
    title: 'The Shipyard',
    kicker: 'Work — web, product & AI-assisted delivery',
    html: `
        <div class="panel-section">
            <p>Case studies across creative direction, project and product management: websites, platforms and campaigns I owned from brief and scoping through production, QA and launch.</p>
        </div>

        <div class="panel-section">
            <h4>Ships launched</h4>
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
};
