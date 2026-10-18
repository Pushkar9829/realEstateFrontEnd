import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { loadAll } from '@/shared/i18n/locales';

// Dictionaries load on demand in the app; tests get every language up front.
await loadAll();

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom has no <dialog> modal support.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
}
