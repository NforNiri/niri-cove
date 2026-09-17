import about from './AboutPanel.js';
import work from './WorkPanel.js';
import creative from './CreativePanel.js';
import resume from './ResumePanel.js';
import contact from './ContactPanel.js';
import captainslog from './CaptainsLog.js';

const panels = { about, work, creative, resume, contact, captainslog };

export function getContent(zoneId) {
    const p = panels[zoneId];
    if (!p) return null;
    // Dynamic panels (Captain's Log) build from current progress
    return typeof p === 'function' ? p() : p;
}
