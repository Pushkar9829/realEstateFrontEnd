// Growth Hub lead status (backend hubWebhook.service.js): the agent activity
// timeline shows the hub's `hub` entries in English and Hindi.
import { describe, test, expect, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui';
import { Timeline } from '@/panels/agent/components/lead/ActivityPanels';
import { setLang, translate } from '@/shared/i18n';
import { loadNamespaces } from '@/shared/i18n/locales';

afterEach(() => { act(() => setLang('en')); });

const lead = {
  _id: 'l1',
  timeline: [{ _id: 'e1', type: 'hub', at: '2026-10-21T06:30:00.000Z', byName: 'System', data: { event: 'lead.status_changed', status: 'contacted', stageLabel: 'Contacted', owner: 'Neha S.' } }],
};
const view = () => render(<QueryClientProvider client={new QueryClient()}><ToastProvider><Timeline lead={lead} /></ToastProvider></QueryClientProvider>);

describe('agent timeline: Growth Hub status entry', () => {
  test('English', async () => {
    await act(async () => { await loadNamespaces('en', ['agent']); setLang('en'); });
    view();
    expect(screen.getByText(`${translate('en', 'agent.activity.tl.hub', { status: 'Contacted' })} · Neha S.`)).toBeInTheDocument();
  });

  test('Hindi', async () => {
    await act(async () => { await loadNamespaces('hi', ['agent']); setLang('hi'); });
    view();
    const text = translate('hi', 'agent.activity.tl.hub', { status: 'Contacted' });
    expect(text).not.toBe(translate('en', 'agent.activity.tl.hub', { status: 'Contacted' }));
    expect(screen.getByText(`${text} · Neha S.`)).toBeInTheDocument();
  });
});
