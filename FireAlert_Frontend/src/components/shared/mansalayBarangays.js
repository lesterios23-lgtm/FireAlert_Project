// Official 17 barangays of Mansalay, Oriental Mindoro.
// Sources: PhilAtlas Mansalay profile + Wikipedia list of Mansalay barangays.
export const MANSALAY_BARANGAYS = [
  'B. Del Mundo',
  'Balugo',
  'Bonbon',
  'Budburan',
  'Cabalwa',
  'Don Pedro',
  'Maliwanag',
  'Manaul',
  'Panaytayan',
  'Poblacion',
  'Roma',
  'Santa Brigida',
  'Santa Maria',
  'Santa Teresita',
  'Villa Celestial',
  'Wasig',
  'Waygan',
];

const NORMALIZED_LOOKUP = new Map(
  MANSALAY_BARANGAYS.map((name) => [name.toLowerCase().replace(/[^a-z0-9]/g, ''), name])
);

function normalizeBarangayInput(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^(barangay|brgy\.?)\s+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

function stripBarangayPrefix(value) {
  return String(value || '').replace(/^(barangay|brgy\.?)\s+/i, '').trim();
}

/** Returns the canonical Mansalay barangay name, or null when it is not one of the 17. */
export function matchMansalayBarangay(value) {
  const key = normalizeBarangayInput(value);
  if (!key) return null;
  if (NORMALIZED_LOOKUP.has(key)) return NORMALIZED_LOOKUP.get(key);
  // Sta. / Santo abbreviations typed by residents still resolve to the official name.
  const expanded = key.replace(/^sta/, 'santa').replace(/^sto/, 'santo');
  if (NORMALIZED_LOOKUP.has(expanded)) return NORMALIZED_LOOKUP.get(expanded);
  return null;
}

/** Live suggestions while typing: only Mansalay barangays, prefix matches first. */
export function suggestMansalayBarangays(query, limit = 7) {
  const needle = normalizeBarangayInput(query);
  const pool = needle
    ? MANSALAY_BARANGAYS.filter((name) => normalizeBarangayInput(name).includes(needle))
    : [...MANSALAY_BARANGAYS];
  pool.sort((a, b) => {
    const na = normalizeBarangayInput(a);
    const nb = normalizeBarangayInput(b);
    const pa = needle && na.startsWith(needle) ? 0 : 1;
    const pb = needle && nb.startsWith(needle) ? 0 : 1;
    return pa - pb || a.localeCompare(b);
  });
  return pool.slice(0, limit);
}

/** Display form used everywhere: "Brgy. Poblacion". */
export function formatBarangayName(value) {
  const canonical = matchMansalayBarangay(value) || stripBarangayPrefix(value);
  return canonical ? `Brgy. ${canonical}` : '';
}

/** Builds the full registration address saved on the profile. */
export function buildResidentAddress({ houseDetail = '', barangay = '' }) {
  const canonical = matchMansalayBarangay(barangay);
  const parts = [
    String(houseDetail || '').trim(),
    canonical ? formatBarangayName(canonical) : String(barangay || '').trim(),
    'Mansalay',
    'Oriental Mindoro',
  ].filter(Boolean);
  return { address: parts.join(', '), barangay: canonical || '' };
}
