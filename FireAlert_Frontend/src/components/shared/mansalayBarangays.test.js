import {
  MANSALAY_BARANGAYS,
  buildResidentAddress,
  matchMansalayBarangay,
  suggestMansalayBarangays,
} from './mansalayBarangays';

test('contains exactly the 17 official Mansalay barangays', () => {
  expect(MANSALAY_BARANGAYS).toHaveLength(17);
  expect(MANSALAY_BARANGAYS).toContain('Poblacion');
  expect(MANSALAY_BARANGAYS).toContain('Panaytayan');
});

test('matches official names regardless of prefix or casing', () => {
  expect(matchMansalayBarangay('poblacion')).toBe('Poblacion');
  expect(matchMansalayBarangay('Brgy. Poblacion')).toBe('Poblacion');
  expect(matchMansalayBarangay('Barangay Sta. Brigida')).toBe('Santa Brigida');
  expect(matchMansalayBarangay('Bongabong')).toBeNull();
  expect(matchMansalayBarangay('')).toBeNull();
});

test('suggests only Mansalay barangays while typing', () => {
  const all = suggestMansalayBarangays('', 20);
  expect(all).toHaveLength(17);

  const santa = suggestMansalayBarangays('santa');
  expect(santa).toEqual(expect.arrayContaining(['Santa Brigida', 'Santa Maria', 'Santa Teresita']));
  expect(santa).not.toContain('Poblacion');

  expect(suggestMansalayBarangays('bongabong')).toEqual([]);
});

test('builds a Mansalay-scoped registration address', () => {
  const { address, barangay } = buildResidentAddress({ houseDetail: 'Purok 3', barangay: 'poblacion' });
  expect(barangay).toBe('Poblacion');
  expect(address).toBe('Purok 3, Brgy. Poblacion, Mansalay, Oriental Mindoro');
});
