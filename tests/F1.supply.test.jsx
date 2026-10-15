// Frontend phase F1 - supply side: helpers behind the listing wizard, builder
// projects and the shared upload widget. Test names follow "[Module][panel] FEATURE-ID ...".
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { missingSteps, priceOf, listingStatus } from '@/modules/listings/api';
import { projectMissing, reraWarning } from '@/modules/projects/api';
import { docLabel, kycStatus } from '@/modules/kyc/api';
import { agreementStatus } from '@/modules/approvals/agreements';

const full = {
  purpose: 'sale', wizard: { stepsDone: [1, 2, 3, 4, 5, 6, 7] }, activeAgreementId: 'a1', price: { amount: 850000000 },
  media: { photos: [{}, {}, {}], ownershipProofs: [{ fileId: 'f' }] },
};

describe('[A][lister] RE-A-03 wizard completeness mirrors the submit rules', () => {
  test('a complete owner listing has nothing missing', () => {
    expect(missingSteps(full, { builder: false })).toEqual([]);
  });
  test('missing steps, photos, proof and commission are all reported', () => {
    const m = missingSteps({ wizard: { stepsDone: [1] }, media: { photos: [{}] } }, { builder: false }).map((x) => x.step);
    expect(m).toEqual([2, 3, 4, 5, 6, 6, 7]);
  });
  test('rejected photos do not count; builders need RERA instead of proof', () => {
    const l = { ...full, media: { photos: [{}, {}, { moderation: { status: 'rejected' } }], ownershipProofs: [] } };
    const texts = missingSteps(l, { builder: true }).map((x) => x.text);
    expect(texts.join(' ')).toMatch(/At least 3 photos \(2 added\)/);
    expect(texts.join(' ')).toMatch(/RERA/);
    expect(texts.join(' ')).not.toMatch(/Ownership proof/);
  });
  test('price helper picks sale price or monthly rent; statuses have labels', () => {
    expect(priceOf(full)).toBe(850000000);
    expect(priceOf({ purpose: 'rent', price: { monthlyRent: 3200000 } })).toBe(3200000);
    expect(listingStatus('changes_requested')).toMatchObject({ label: 'Changes requested', tone: 'warning' });
  });
});

describe('[G][lister] RE-G-02/08 project submit checklist', () => {
  test('lists every missing tab, and accepts a RERA exemption', () => {
    expect(projectMissing({}).map(([k]) => k)).toEqual(['details', 'location', 'configurations', 'rera', 'commission']);
    const ok = { description: 'x', location: { geo: {} }, configurations: [{}], rera: { exempt: { reason: 'upto_8_units' } }, activeAgreementId: 'a' };
    expect(projectMissing(ok)).toEqual([]);
  });
  test('RERA warning codes become readable text', () => {
    expect(reraWarning('rera_url_host:P521')).toBe('Link is not on the official RERA site (P521)');
  });
});

describe('[F][D][shared] labels', () => {
  test('KYC, document and agreement labels', () => {
    expect(kycStatus('resubmission_required').label).toBe('Resubmission needed');
    expect(docLabel('pan_card')).toBe('PAN card');
    expect(agreementStatus('countersigned')).toMatchObject({ tone: 'success' });
  });
});

describe('[Infra][shared] RE-A-05 upload widget', () => {
  test('rejects wrong types and oversize files before uploading', async () => {
    const FileDrop = (await import('@/shared/components/FileDrop')).default;
    const onUploaded = vi.fn();
    render(<FileDrop purpose="kyc_doc" kind="document" onUploaded={onUploaded} label="Upload file" />);
    const input = document.querySelector('input[type=file]');
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('notes.txt: use PDF, JPG or PNG up to 10 MB'));
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1048576 });
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('big.pdf: larger than 10 MB'));
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
