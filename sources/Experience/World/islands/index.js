import AboutIsland from './AboutIsland.js';
import WorkIsland from './WorkIsland.js';
import CreativeIsland from './CreativeIsland.js';
import ResumeIsland from './ResumeIsland.js';
import ContactIsland from './ContactIsland.js';
import { ISLANDS } from '../layout.js';

const BUILDERS = {
    about: AboutIsland,
    work: WorkIsland,
    creative: CreativeIsland,
    resume: ResumeIsland,
    contact: ContactIsland,
};

export function buildIslands() {
    return ISLANDS.map((data) => {
        const Builder = BUILDERS[data.id];
        return new Builder(data);
    });
}
