// HighBrainnet — localStorage-backed cart
// Items: { itemType: 'course'|'package'|'upgrade', courseId?, versionId?, packageId?, title, price, coverImageUrl?, slug? }

(function () {
  const KEY = 'hbn.cart';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }
  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('hbn:cart-changed', { detail: { count: items.length } }));
  }

  function items() { return read(); }
  function count() { return read().length; }
  function total() {
    return read().reduce((s, it) => s + Number(it.price || 0), 0);
  }

  function keyOf(it) {
    return [it.itemType, it.courseId, it.versionId, it.packageId].filter(Boolean).join(':');
  }

  function add(item) {
    const cur = read();
    const k = keyOf(item);
    if (cur.some((c) => keyOf(c) === k)) return false;
    cur.push(item);
    write(cur);
    return true;
  }

  function remove(item) {
    const k = keyOf(item);
    write(read().filter((c) => keyOf(c) !== k));
  }

  function clear() { write([]); }

  // For checkout — convert to order payload
  function toOrderItems() {
    return read().map((it) => {
      const out = { itemType: it.itemType };
      if (it.courseId)  out.courseId  = it.courseId;
      if (it.versionId) out.versionId = it.versionId;
      if (it.packageId) out.packageId = it.packageId;
      return out;
    });
  }

  function bindCountBadge(selector = '[data-cart-badge]') {
    const update = () => {
      const n = count();
      document.querySelectorAll(selector).forEach((el) => {
        el.textContent = n;
        el.style.display = n > 0 ? '' : 'none';
      });
    };
    update();
    document.addEventListener('hbn:cart-changed', update);
  }

  window.HBN = window.HBN || {};
  window.HBN.cart = {
    items, count, total, add, remove, clear, toOrderItems, bindCountBadge,
  };
})();
