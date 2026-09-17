/**
 * Project data for the Shipyard. Fill copy here, not markup.
 *
 * thumb:     /thumbs/<slug>.jpg (640x400). Drop a replacement file with the
 *            same name to swap a screenshot for a mockup.
 * what:      one line on what the product/site is (shown on the card)
 * role:      what Niri owned
 * challenge / outcome: optional case-study detail (shown when expanded).
 *            Leave null and the card simply shows role + link.
 */
export const CD = 'Creative Direction';
export const PM = 'Project Management';
export const PROD = 'Product Management';
export const AN = 'Analytics';

export const FILTERS = [
    { id: 'all', label: 'All' },
    { id: CD, label: 'Creative' },
    { id: PM, label: 'PM' },
    { id: PROD, label: 'Product' },
    { id: AN, label: 'Analytics' },
];

export const PROJECTS = [
    {
        slug: 'localz', name: 'Localz', url: 'https://localz-group.com/', tags: [CD, PM],
        what: 'Urban hospitality: furnished stays in Tel Aviv and Jerusalem, booked online.',
        role: 'Creative direction and delivery of the brand site and booking flow, brief to launch.',
        challenge: null, outcome: null,
    },
    {
        slug: 'and-law', name: 'A&D Law', url: 'https://and-law.co.il/', tags: [CD, PM],
        what: 'Criminal-law firm led by former police prosecutors.',
        role: 'Creative direction and project management for the firm\u2019s web presence.',
        challenge: null, outcome: null,
    },
    {
        slug: 'tictruck', name: 'TicTruck', url: 'https://www.tictruck.co.il/', tags: [PM],
        what: 'Transport management system (TMS) for fleets, deliveries and pricing.',
        role: 'Project management of the marketing site and demo funnel.',
        challenge: null, outcome: null,
    },
    {
        slug: 'simplex3d', name: 'Simplex3D', url: 'https://www.simplex3d.com/', tags: [PROD, AN],
        what: 'A 3D platform for urban planning and city management.',
        role: 'Product management and analytics: roadmap, requirements, KPIs and reporting.',
        challenge: null, outcome: null,
    },
    {
        slug: 'lpi-fire', name: 'LPI Fire', url: 'https://lpifire.com/', tags: [PM],
        what: 'Corporate site for a fire-protection company.',
        role: 'Project management, scoping through QA and launch.',
        challenge: null, outcome: null,
    },
    {
        slug: 'tal-rapaport', name: 'Dr Tal Rappaport', url: 'https://coreandcode.co.il/web/tal-rappaport/index.html', tags: [PM],
        what: 'Professional site for Dr Tal Rappaport.',
        role: 'Project management and client liaison.',
        challenge: null, outcome: null,
    },
    {
        slug: 'podcastia', name: 'Podcastia', url: 'https://podcastiya.co.il/', tags: [PM],
        what: 'A 24/7 self-service podcast studio in Netanya: record and publish in one click.',
        role: 'Project management of the site and booking experience.',
        challenge: null, outcome: null,
    },
    {
        slug: 'rakafot', name: 'Rakafot', url: 'https://rakafot.org.il/', tags: [CD, PM],
        what: 'Educational non-profit for youth leadership and social change.',
        role: 'Creative direction and project management of the organisation\u2019s site.',
        challenge: null, outcome: null,
    },
    {
        slug: 'force-media', name: 'Force Media', url: 'https://forcemedia.co.il/', tags: [PM],
        what: 'Digital agency: PPC, branding, content and social.',
        role: 'Project management for the agency\u2019s own site.',
        challenge: null, outcome: null,
    },
    {
        slug: 'sparking-ai', name: 'Sparking.AI', url: 'https://www.sparking.ai/', tags: [CD, PM],
        what: 'AI company web presence.',
        role: 'Creative direction and project management.',
        challenge: null, outcome: null,
    },
    {
        slug: 'justi', name: 'Justi', url: 'https://www.justi.co.il/', tags: [CD, PM],
        what: 'Workforce management: teams, shifts and payroll in one place.',
        role: 'Creative direction and delivery of the marketing site and demo funnel.',
        challenge: null, outcome: null,
    },
    {
        slug: null, name: 'Play and more', url: null, tags: [PM],
        what: 'Project management engagement.',
        role: 'Project management.',
        challenge: null, outcome: null,
    },
    {
        slug: 'mophet', name: 'Mophet', url: 'https://www.mophet.com/', tags: [PM],
        what: 'Luxury residential complex in Ra\u2019anana.',
        role: 'Project management of the sales site.',
        challenge: null, outcome: null,
    },
    {
        slug: 'shir-meidan', name: 'Shir Meidan', url: 'https://shirmeidan.com/', tags: [PM],
        what: 'Personal brand site.',
        role: 'Project management.',
        challenge: null, outcome: null,
    },
    {
        slug: 'proxi', name: 'Proxi', url: 'https://proxi.co.il/', tags: [CD, PM],
        what: 'Smart locks for the home: fingerprint, code, app and face unlock.',
        role: 'Creative direction and project management of the e-commerce site.',
        challenge: null, outcome: null,
    },
    {
        slug: 'tagiz', name: 'Tagiz', url: 'https://tagiz.com/', tags: [PM],
        what: 'Smart QR tags that help lost luggage, pets and kids find their way home.',
        role: 'Project management of the store and product pages.',
        challenge: null, outcome: null,
    },
    {
        slug: 'veriix', name: 'Veriix', url: 'https://veriix.net/', tags: [PM],
        what: 'Company site for Veriix.',
        role: 'Project management.',
        challenge: null, outcome: null,
    },
    {
        slug: 'mum-wood', name: 'Mum Wood', url: 'https://mumwood.co.il/', tags: [PM],
        what: 'Montessori birch furniture for children\u2019s rooms.',
        role: 'Project management of the catalogue and shop.',
        challenge: null, outcome: null,
    },
    {
        slug: 'pool-reef', name: 'Pool & Reef', url: 'https://pool-reef.co.il/', tags: [CD, PM],
        what: 'Design and construction of swimming pools and luxury outdoor spaces.',
        role: 'Creative direction and project management.',
        challenge: null, outcome: null,
    },
    {
        slug: 'casinofy', name: 'Casinofy', url: 'https://www.casinofy.com/', tags: [PM],
        what: 'Independent online casino reviews: 560+ tested casinos, 1,600+ game reviews.',
        role: 'Project management of the platform build.',
        challenge: null, outcome: null,
    },
    {
        slug: 'artemis', name: 'Artemis Diamonds', url: 'https://artemis-diamonds.co.il/', tags: [PM],
        what: 'Diamond jewellery e-commerce.',
        role: 'Project management of the store.',
        challenge: null, outcome: null,
    },
];
