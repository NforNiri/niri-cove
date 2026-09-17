// Kenney Pirate Kit (CC0) — GLB models with a shared colormap texture.
// Names here are the keys used by islands, boat and floaters via resources.items[name].
const base = '/models/pirate';

const models = [
    // Player boat + other vessels
    'ship-small',
    'ship-pirate-medium',
    'ship-wreck',
    'boat-row-small',
    'boat-row-large',

    // Docks & structures
    'structure-platform-dock',
    'structure-platform-dock-small',
    'structure-platform',
    'structure-platform-small',
    'structure',
    'structure-roof',
    'structure-fence',
    'structure-fence-sides',
    'platform-planks',
    'tower-complete-small',
    'tower-complete-large',
    'tower-watch',
    'castle-wall',
    'castle-gate',

    // Props
    'barrel',
    'crate',
    'crate-bottles',
    'chest',
    'bottle',
    'bottle-large',
    'cannon',
    'cannon-mobile',
    'cannon-ball',
    'flag-pirate',
    'flag-pirate-high',
    'flag-high',
    'flag',
    'flag-pennant',
    'tool-paddle',
    'tool-shovel',
    'hole',

    // Nature
    'palm-straight',
    'palm-bend',
    'palm-detailed-straight',
    'palm-detailed-bend',
    'grass-patch',
    'grass-plant',
    'patch-sand',
    'patch-sand-foliage',
    'patch-grass',
    'patch-grass-foliage',
    'rocks-a',
    'rocks-b',
    'rocks-c',
    'rocks-sand-a',
    'rocks-sand-b',
    'rocks-sand-c',
];

export default models.map((name) => ({
    name,
    type: 'gltfModel',
    path: `${base}/${name}.glb`,
}));
