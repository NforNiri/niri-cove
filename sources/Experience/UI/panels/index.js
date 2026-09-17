import about from './AboutPanel.js';
import work from './WorkPanel.js';
import creative from './CreativePanel.js';
import resume from './ResumePanel.js';
import contact from './ContactPanel.js';
import captainslog from './CaptainsLog.js';

const panels = { about, work, creative, resume, contact, captainslog };

export function getContent(zoneId) {
    return panels[zoneId] || null;
}
