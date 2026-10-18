import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './index.css';
import { loadInitial } from './shared/i18n/store';

const mount = () => createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// The language dictionaries are separate chunks: load the chosen language first
// (English fallback included), then render. A failed load still renders (missing text shows its key).
loadInitial().then(mount, mount);
