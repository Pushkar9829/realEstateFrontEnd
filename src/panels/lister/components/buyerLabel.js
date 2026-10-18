// The API sends masked buyer labels in English ("Buyer 2", "A buyer"); the
// lister panel shows them in the interface language. Any other text is data.
export function buyerText(t, label) {
  if (!label || label === 'A buyer') return t('lister.common.aBuyer');
  const m = /^Buyer (\d+)$/.exec(String(label));
  return m ? t('lister.common.buyerN', { n: m[1] }) : label;
}
