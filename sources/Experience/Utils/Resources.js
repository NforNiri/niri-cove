import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import EventEmitter from './EventEmitter.js';

console.log('Resources module loaded');

export default class Resources extends EventEmitter {
    constructor(sources) {
        super();
        console.log('✅ Resources initialized');

        this.sources = sources;
        this.items = {};
        this.toLoad = this.sources.length;
        this.loaded = 0;

        // Textures flagged `shared` are loaded first and swapped into any GLB
        // texture of the same name whose embedded image is a 1x1 placeholder
        // (see scripts/compress-models.mjs).
        this.shared = {};

        this.setLoaders();
        this.startLoading();
    }

    setLoaders() {
        this.loaders = {};

        // GLTF Loader: meshopt-compressed, quantized GLBs (scripts/compress-models.mjs)
        this.loaders.gltfLoader = new GLTFLoader();
        this.loaders.gltfLoader.setMeshoptDecoder(MeshoptDecoder);

        // Texture Loader
        this.loaders.textureLoader = new THREE.TextureLoader();

        // Audio Loader
        this.loaders.audioLoader = new THREE.AudioLoader();

        // OBJ + MTL Loader
        this.loaders.mtlLoader = new MTLLoader();
        this.loaders.objLoader = new OBJLoader();
    }

    startLoading() {
        if (this.sources.length === 0) {
            console.log('No assets to load');
            this.emit('ready');
            return;
        }

        // Shared textures first (tiny), then everything else in parallel
        const sharedSources = this.sources.filter((s) => s.type === 'texture' && s.shared);
        const rest = this.sources.filter((s) => !(s.type === 'texture' && s.shared));
        let pending = sharedSources.length;
        const next = () => { if (--pending <= 0) this.loadSources(rest); };
        if (!pending) return this.loadSources(rest);
        for (const source of sharedSources) {
            this.loaders.textureLoader.load(
                source.path,
                (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.flipY = false; // glTF UV convention
                    this.shared[source.name] = tex;
                    this.sourceLoaded(source, tex);
                    next();
                },
                undefined,
                (error) => {
                    console.error(`Error loading shared texture ${source.name}:`, error);
                    this.sourceLoaded(source, null);
                    next();
                }
            );
        }
    }

    /** Swap 1x1 placeholder images for the shared texture of the same name. */
    applySharedTextures(gltf) {
        if (!gltf || !gltf.scene) return;
        const seen = new Set();
        gltf.scene.traverse((child) => {
            if (!child.isMesh) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
                const map = mat && mat.map;
                if (!map || seen.has(map)) continue;
                seen.add(map);
                const shared = this.shared[map.name];
                const img = map.image;
                if (!shared || !img || img.width !== 1) continue;
                map.image = shared.image;
                map.colorSpace = shared.colorSpace;
                map.needsUpdate = true;
            }
        });
    }

    loadSources(sources) {
        for (const source of sources) {
            if (source.type === 'gltfModel') {
                this.loaders.gltfLoader.load(
                    source.path,
                    (file) => {
                        this.applySharedTextures(file);
                        this.sourceLoaded(source, file);
                    },
                    (progress) => {
                        // Optional: emit progress events
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        this.emit('progress', {
                            name: source.name,
                            percent: percentComplete
                        });
                    },
                    (error) => {
                        if (source.optional) console.info(`Optional asset not present: ${source.name} — using fallback`);
                        else console.error(`Error loading ${source.name}:`, error);
                        // Still count as loaded to avoid blocking
                        this.sourceLoaded(source, null);
                    }
                );
            } else if (source.type === 'texture') {
                this.loaders.textureLoader.load(
                    source.path,
                    (file) => {
                        this.sourceLoaded(source, file);
                    },
                    undefined,
                    (error) => {
                        console.error(`Error loading texture ${source.name}:`, error);
                        this.sourceLoaded(source, null);
                    }
                );
            } else if (source.type === 'objModel') {
                // Extract base path for MTL resource resolution
                const mtlBasePath = source.mtlPath.substring(0, source.mtlPath.lastIndexOf('/') + 1);
                const mtlFile = source.mtlPath.substring(source.mtlPath.lastIndexOf('/') + 1);
                const mtlLoader = new MTLLoader();
                mtlLoader.setPath(mtlBasePath);
                mtlLoader.load(
                    mtlFile,
                    (materials) => {
                        materials.preload();
                        const objLoader = new OBJLoader();
                        objLoader.setMaterials(materials);
                        objLoader.load(
                            source.path,
                            (obj) => {
                                this.sourceLoaded(source, obj);
                            },
                            undefined,
                            (error) => {
                                console.error(`Error loading OBJ ${source.name}:`, error);
                                this.sourceLoaded(source, null);
                            }
                        );
                    },
                    undefined,
                    (error) => {
                        console.warn(`MTL not loaded for ${source.name}, loading OBJ without materials`);
                        this.loaders.objLoader.load(
                            source.path,
                            (obj) => {
                                this.sourceLoaded(source, obj);
                            },
                            undefined,
                            (err) => {
                                console.error(`Error loading OBJ ${source.name}:`, err);
                                this.sourceLoaded(source, null);
                            }
                        );
                    }
                );
            } else if (source.type === 'audio') {
                this.loaders.audioLoader.load(
                    source.path,
                    (file) => {
                        this.sourceLoaded(source, file);
                    },
                    undefined,
                    (error) => {
                        console.error(`Error loading audio ${source.name}:`, error);
                        this.sourceLoaded(source, null);
                    }
                );
            }
        }
    }

    sourceLoaded(source, file) {
        this.items[source.name] = file;
        this.loaded++;

        const progress = (this.loaded / this.toLoad) * 100;
        console.log(`Asset loaded: ${source.name} (${this.loaded}/${this.toLoad}) - ${progress.toFixed(0)}%`);

        if (this.loaded === this.toLoad) {
            console.log('✅ All assets loaded!');
            this.emit('ready');
        }
    }
}
