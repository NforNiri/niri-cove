import { inject } from '@vercel/analytics';
import Experience from './Experience/Experience.js';

// Vercel Web Analytics (vanilla equivalent of the <Analytics /> component).
// The script only loads on Vercel; locally the /_vercel/insights 404 is expected.
inject({ mode: import.meta.env.PROD ? 'production' : 'development' });

new Experience();
