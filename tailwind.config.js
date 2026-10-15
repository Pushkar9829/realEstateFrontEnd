import { fileURLToPath } from 'node:url';
import preset from './src/design/tailwind.preset.js';

// Absolute globs (forward slashes) so the build works from any working directory.
const here = (p) => fileURLToPath(new URL(p, import.meta.url)).split('\\').join('/');

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [here('./index.html'), `${here('./src')}/**/*.{js,jsx}`],
};
