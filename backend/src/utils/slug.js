const crypto = require('crypto');

// Build a URL-safe slug. Strips Thai/non-ASCII; falls back to random suffix
// when nothing usable remains. Always non-empty.
function slugify(input, { maxLength = 60, fallbackPrefix = 'item' } = {}) {
  const ascii = String(input || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);

  // Need ≥3 ascii chars to be a meaningful slug
  if (ascii && ascii.replace(/-/g, '').length >= 3) return ascii;
  return `${fallbackPrefix}-${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { slugify };
