const STORAGE_KEY = "cashreg.entries.v1";
const META_KEY = "cashreg.meta.v1";
const CATEGORIES_KEY = "cashreg.categories.v1";
const CURRENCY_KEY = "cashreg.currency";

// GBP/EUR/USD are pinned first as the common quick picks; everything else
// fills out the "All currencies" group in the same dropdown.
const COMMON_CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
];

const OTHER_CURRENCIES = [
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "ARS", symbol: "$", name: "Argentine Peso" },
  { code: "AUD", symbol: "$", name: "Australian Dollar" },
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "CLP", symbol: "$", name: "Chilean Peso" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "COP", symbol: "$", name: "Colombian Peso" },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna" },
  { code: "DKK", symbol: "kr", name: "Danish Krone" },
  { code: "EGP", symbol: "£", name: "Egyptian Pound" },
  { code: "HKD", symbol: "$", name: "Hong Kong Dollar" },
  { code: "HUF", symbol: "Ft", name: "Hungarian Forint" },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "ILS", symbol: "₪", name: "Israeli Shekel" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "ISK", symbol: "kr", name: "Icelandic Krona" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "KRW", symbol: "₩", name: "South Korean Won" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone" },
  { code: "NZD", symbol: "$", name: "New Zealand Dollar" },
  { code: "PEN", symbol: "S/", name: "Peruvian Sol" },
  { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  { code: "PKR", symbol: "₨", name: "Pakistani Rupee" },
  { code: "PLN", symbol: "zł", name: "Polish Zloty" },
  { code: "RON", symbol: "lei", name: "Romanian Leu" },
  { code: "RUB", symbol: "₽", name: "Russian Ruble" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "SGD", symbol: "$", name: "Singapore Dollar" },
  { code: "THB", symbol: "฿", name: "Thai Baht" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
  { code: "TWD", symbol: "NT$", name: "Taiwan Dollar" },
  { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia" },
  { code: "VND", symbol: "₫", name: "Vietnamese Dong" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
];

const ALL_CURRENCIES = [...COMMON_CURRENCIES, ...OTHER_CURRENCIES];

let currentCurrencyCode = localStorage.getItem(CURRENCY_KEY) || "GBP";

function getCurrency() {
  return ALL_CURRENCIES.find((c) => c.code === currentCurrencyCode) || COMMON_CURRENCIES[0];
}

function setCurrency(code) {
  currentCurrencyCode = code;
  localStorage.setItem(CURRENCY_KEY, code);
  render();
}

function renderCurrencySelect() {
  const select = document.getElementById("currency-select");
  if (select.options.length === 0) {
    const commonGroup = document.createElement("optgroup");
    commonGroup.label = "Common";
    COMMON_CURRENCIES.forEach((c) => commonGroup.appendChild(new Option(`${c.code} (${c.symbol}) — ${c.name}`, c.code)));
    select.appendChild(commonGroup);

    const otherGroup = document.createElement("optgroup");
    otherGroup.label = "All currencies";
    OTHER_CURRENCIES.forEach((c) => otherGroup.appendChild(new Option(`${c.code} (${c.symbol}) — ${c.name}`, c.code)));
    select.appendChild(otherGroup);
  }
  select.value = currentCurrencyCode;
}

function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  return dateToStr(new Date());
}

function bumpLocalUpdatedAt() {
  localStorage.setItem(META_KEY, JSON.stringify({ updatedAt: Date.now() }));
}

function getLocalUpdatedAt() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw).updatedAt : 0;
  } catch (e) {
    return 0;
  }
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load entries", e);
    return [];
  }
}

// --- Undo ---
// Snapshots the pre-mutation state before every save, so Undo can restore it.
// Multiple saves within the same synchronous action are coalesced into one
// undo step via the pending-flag trick below.
const UNDO_LIMIT = 25;
let undoStack = [];
let undoSnapshotPending = false;

function pushUndoSnapshot() {
  if (undoSnapshotPending) return;
  undoStack.push({
    entries: localStorage.getItem(STORAGE_KEY) || "[]",
    categories: localStorage.getItem(CATEGORIES_KEY) || "[]",
  });
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  undoSnapshotPending = true;
  setTimeout(() => { undoSnapshotPending = false; }, 0);
  updateUndoButtonState();
}

function performUndo() {
  const snapshot = undoStack.pop();
  if (!snapshot) return;
  entries = JSON.parse(snapshot.entries);
  categories = JSON.parse(snapshot.categories);
  localStorage.setItem(STORAGE_KEY, snapshot.entries);
  localStorage.setItem(CATEGORIES_KEY, snapshot.categories);
  bumpLocalUpdatedAt();
  updateUndoButtonState();
  render();
}

function updateUndoButtonState() {
  const btn = document.getElementById("undo-btn");
  if (!btn) return;
  btn.disabled = undoStack.length === 0;
  btn.dataset.tip = undoStack.length ? `Undo your last change (${undoStack.length} available)` : "Nothing to undo";
}

function saveEntries(list) {
  pushUndoSnapshot();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  bumpLocalUpdatedAt();
}

let entries = loadEntries();

// Migrate records from before per-record merge sync existed.
entries.forEach((entry) => {
  if (entry.updatedAt === undefined) {
    entry.updatedAt = entry.createdAt ? Date.parse(entry.createdAt) || Date.now() : Date.now();
  }
  if (entry.deleted === undefined) entry.deleted = false;
});
saveEntries(entries);

// --- Categories (what the spend was for, e.g. Groceries, Travel — distinct
// from Location, which is where it happened) ---
const CATEGORY_COLOR_PALETTE = [
  "#e05263", "#e0a63b", "#d4c04a", "#5fb86d", "#16a3a3",
  "#3b6ff0", "#7c6fe0", "#a85fd1", "#d1608f", "#8a8f98",
];

const DEFAULT_CATEGORY_NAMES = [
  "Groceries", "Travel", "Transport", "BCR", "Leisure", "Insurance", "Tax",
  "Clothing", "Health", "Books", "Gifts", "Subscription & Utilities",
  "Business", "Tech", "Home", "Loan", "Hobbies", "Rental", "Moving", "Education",
];

function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load categories", e);
    return [];
  }
}

function saveCategories(list) {
  pushUndoSnapshot();
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
  bumpLocalUpdatedAt();
}

let categories = loadCategories();

if (categories.length === 0) {
  categories = DEFAULT_CATEGORY_NAMES.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    color: CATEGORY_COLOR_PALETTE[i % CATEGORY_COLOR_PALETTE.length],
    archived: false,
    lastUsedAt: 0,
    updatedAt: Date.now(),
  }));
  saveCategories(categories);
}

function categoryById(id) {
  return categories.find((c) => c.id === id) || null;
}

function touchCategory(category) {
  category.updatedAt = Date.now();
}

function nextCategoryColor() {
  return CATEGORY_COLOR_PALETTE[categories.length % CATEGORY_COLOR_PALETTE.length];
}

function getOrCreateCategoryByName(name) {
  const trimmed = name.trim();
  let category = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (!category) {
    category = { id: crypto.randomUUID(), name: trimmed, color: nextCategoryColor(), archived: false, lastUsedAt: Date.now(), updatedAt: Date.now() };
    categories.push(category);
  } else {
    category.lastUsedAt = Date.now();
    category.archived = false;
    touchCategory(category);
  }
  saveCategories(categories);
  return category;
}

function recentCategories(limit = 8) {
  return categories
    .filter((c) => !c.archived)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

function categoryCountForEntries(categoryId) {
  return entries.filter((e) => e.categoryId === categoryId && !e.deleted).length;
}

function activeEntries() {
  return entries.filter((e) => !e.deleted);
}

function touchEntry(entry) {
  entry.updatedAt = Date.now();
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return `${getCurrency().symbol}${n.toFixed(2)}`;
}

function formatDateBadge(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

function recentLocations(limit = 8) {
  const byLocation = new Map();
  activeEntries().forEach((e) => {
    if (!e.location) return;
    const key = e.location.toLowerCase();
    const existing = byLocation.get(key);
    if (!existing || e.updatedAt > existing.updatedAt) {
      byLocation.set(key, { name: e.location, updatedAt: e.updatedAt });
    }
  });
  return [...byLocation.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

function addEntry({ date, amount, location, comment, categoryId }) {
  const entry = {
    id: crypto.randomUUID(),
    date,
    amount,
    location: location || "",
    comment: comment || "",
    categoryId: categoryId || null,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    deleted: false,
  };
  entries.push(entry);
  saveEntries(entries);
  render();
}

function deleteEntry(id) {
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.deleted = true;
    touchEntry(entry);
  }
  saveEntries(entries);
  render();
}

function restoreEntry(id) {
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.deleted = false;
    touchEntry(entry);
  }
  saveEntries(entries);
  render();
}

// Wraps a text input with a click/search dropdown. `getMatches(query)` returns
// up to a handful of {name, color?} options. Selecting one sets the input
// value and fires "change", so it reuses whatever change handler is already
// wired on that input.
function attachAutocomplete(input, getMatches) {
  const wrap = document.createElement("div");
  wrap.className = "field-autocomplete";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const dropdown = document.createElement("div");
  dropdown.className = "field-dropdown";
  dropdown.hidden = true;
  wrap.appendChild(dropdown);

  function renderOptions() {
    const matches = getMatches(input.value.trim().toLowerCase());
    dropdown.innerHTML = "";
    if (matches.length === 0) {
      dropdown.hidden = true;
      return;
    }
    matches.forEach((m) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "field-dropdown-item";
      if (m.color) {
        const dot = document.createElement("span");
        dot.className = "field-dropdown-dot";
        dot.style.background = m.color;
        item.appendChild(dot);
      }
      item.appendChild(document.createTextNode(m.name));
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = m.name;
        dropdown.hidden = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      dropdown.appendChild(item);
    });
    dropdown.hidden = false;
  }

  input.addEventListener("focus", renderOptions);
  input.addEventListener("input", renderOptions);
  input.addEventListener("blur", () => {
    setTimeout(() => { dropdown.hidden = true; }, 150);
  });
}

function attachLocationAutocomplete(input) {
  attachAutocomplete(input, (query) =>
    recentLocations(50).filter((l) => l.name.toLowerCase().includes(query)).slice(0, 8)
  );
}

function attachCategoryAutocomplete(input) {
  attachAutocomplete(input, (query) =>
    categories.filter((c) => !c.archived && c.name.toLowerCase().includes(query)).slice(0, 8)
  );
}

// Makes `el`'s text content click-to-edit for one field on an entry. `el`
// gets fully replaced by an input while editing.
function makeEditableField(el, entry, field, opts = {}) {
  el.classList.add("editable-field");
  el.tabIndex = 0;
  el.dataset.tip = opts.tip || "Click to edit";
  const displayValue = () => (opts.displayValue ? opts.displayValue(entry) : (entry[field] == null ? "" : entry[field]));
  const startEdit = () => {
    const input = document.createElement("input");
    input.type = opts.type || "text";
    if (opts.step) input.step = opts.step;
    if (opts.min !== undefined) input.min = opts.min;
    input.value = displayValue();
    input.className = "field-edit-input";
    el.replaceWith(input);
    input.focus();
    if (input.select) input.select();
    if (opts.autocomplete) attachLocationAutocomplete(input);
    if (opts.categoryAutocomplete) attachCategoryAutocomplete(input);

    const commit = () => {
      const raw = input.value.trim();
      if (opts.type === "number") {
        const num = parseFloat(raw);
        if (!isNaN(num) && num !== entry[field]) {
          entry[field] = num;
          touchEntry(entry);
          saveEntries(entries);
        }
      } else if (opts.resolve) {
        const newValue = raw ? opts.resolve(raw) : null;
        if (newValue !== entry[field]) {
          entry[field] = newValue;
          touchEntry(entry);
          saveEntries(entries);
        }
      } else if (raw !== entry[field]) {
        entry[field] = raw;
        touchEntry(entry);
        saveEntries(entries);
      }
      render();
    };
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") { input.value = displayValue(); input.blur(); }
    });
  };
  el.addEventListener("click", startEdit);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startEdit();
  });
}

function buildCategoryChip(entry, { editable }) {
  const category = entry.categoryId ? categoryById(entry.categoryId) : null;
  const chip = document.createElement("span");
  chip.className = "category-chip";
  if (category) {
    chip.textContent = category.archived ? `${category.name} (archived)` : category.name;
    chip.style.setProperty("--chip-color", category.color);
  } else {
    chip.textContent = "No category";
    chip.classList.add("category-chip-empty");
  }
  if (editable) {
    makeEditableField(chip, entry, "categoryId", {
      categoryAutocomplete: true,
      tip: "Click to change the category",
      displayValue: (e) => (e.categoryId ? categoryById(e.categoryId)?.name || "" : ""),
      resolve: (name) => getOrCreateCategoryByName(name).id,
    });
  }
  return chip;
}

function buildLogRow(entry, { editable }) {
  const row = document.createElement("div");
  row.className = "log-row";

  const main = document.createElement("div");
  main.className = "log-row-main";

  const dateEl = document.createElement("span");
  dateEl.className = "log-date";
  dateEl.textContent = formatDateBadge(entry.date);
  if (editable) makeEditableField(dateEl, entry, "date", { type: "date", tip: "Click to change the date" });
  main.appendChild(dateEl);

  const amountEl = document.createElement("span");
  amountEl.className = "log-amount";
  amountEl.textContent = formatMoney(entry.amount);
  if (editable) makeEditableField(amountEl, entry, "amount", { type: "number", step: "0.01", min: 0, tip: "Click to change the amount" });
  main.appendChild(amountEl);

  main.appendChild(buildCategoryChip(entry, { editable }));

  const locationEl = document.createElement("span");
  locationEl.className = "log-location";
  locationEl.textContent = entry.location || "—";
  if (editable) makeEditableField(locationEl, entry, "location", { autocomplete: true, tip: "Click to change the location" });
  main.appendChild(locationEl);

  if (editable) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "log-delete-btn";
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", "Delete entry");
    deleteBtn.dataset.tip = "Delete this entry";
    deleteBtn.addEventListener("click", () => deleteEntry(entry.id));
    main.appendChild(deleteBtn);
  } else {
    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "log-restore-btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => restoreEntry(entry.id));
    main.appendChild(restoreBtn);
  }

  row.appendChild(main);

  const commentEl = document.createElement("div");
  commentEl.className = "log-comment";
  commentEl.textContent = entry.comment || "";
  if (editable) makeEditableField(commentEl, entry, "comment", { tip: "Click to edit the comment" });
  row.appendChild(commentEl);

  return row;
}

function renderLogView() {
  const container = document.getElementById("log-list");
  container.innerHTML = "";
  const list = activeEntries().sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });

  if (list.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "No cash payments logged yet.";
    container.appendChild(hint);
    return;
  }

  list.forEach((entry) => container.appendChild(buildLogRow(entry, { editable: true })));
}

function renderArchiveView() {
  const container = document.getElementById("archive-list");
  container.innerHTML = "";
  const list = entries
    .filter((e) => e.deleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (list.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "No deleted entries.";
    container.appendChild(hint);
    return;
  }

  list.forEach((entry) => container.appendChild(buildLogRow(entry, { editable: false })));
}

function renderQaRecentLocations() {
  const container = document.getElementById("qa-recent-locations");
  container.innerHTML = "";
  recentLocations(5).forEach((l) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "location-chip-btn";
    chip.textContent = l.name;
    chip.addEventListener("click", () => {
      document.getElementById("qa-location").value = l.name;
    });
    container.appendChild(chip);
  });
}

function renderQaRecentCategories() {
  const container = document.getElementById("qa-recent-categories");
  container.innerHTML = "";
  recentCategories(5).forEach((c) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "location-chip-btn category-chip-btn";
    chip.textContent = c.name;
    chip.style.setProperty("--chip-color", c.color);
    chip.addEventListener("click", () => {
      document.getElementById("qa-category").value = c.name;
    });
    container.appendChild(chip);
  });
}

// --- Analytics ---
const RANGE_OPTIONS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "custom", label: "Custom" },
];

let analyticsRange = { mode: "week", start: null, end: null };

function addDays(dateStr, delta) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return dateToStr(d);
}

function daysBetween(a, b) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}

function computeRangeBounds() {
  const today = todayStr();
  if (analyticsRange.mode === "day") return { start: today, end: today };
  if (analyticsRange.mode === "week") return { start: addDays(today, -6), end: today };
  if (analyticsRange.mode === "month") return { start: addDays(today, -29), end: today };
  return {
    start: analyticsRange.start || addDays(today, -6),
    end: analyticsRange.end || today,
  };
}

function renderRangePicker() {
  const container = document.getElementById("range-picker");
  container.innerHTML = "";
  RANGE_OPTIONS.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "range-btn";
    btn.textContent = opt.label;
    if (analyticsRange.mode === opt.id) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      analyticsRange.mode = opt.id;
      renderRangePicker();
      renderAnalytics();
    });
    container.appendChild(btn);
  });
  document.getElementById("custom-range-inputs").hidden = analyticsRange.mode !== "custom";
}

function renderAnalytics() {
  const { start, end } = computeRangeBounds();
  const startInput = document.getElementById("range-start");
  const endInput = document.getElementById("range-end");
  if (!startInput.value) startInput.value = analyticsRange.start || start;
  if (!endInput.value) endInput.value = analyticsRange.end || end;

  const inRange = activeEntries().filter((e) => e.date >= start && e.date <= end);
  const total = inRange.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const avg = inRange.length ? total / inRange.length : 0;

  const stats = document.getElementById("analytics-stats");
  stats.innerHTML = "";
  [
    { label: "Total spent", value: formatMoney(total), tip: "Sum of cash payments within the selected range" },
    { label: "Payments", value: inRange.length, tip: "Number of entries within the selected range" },
    { label: "Avg. per payment", value: formatMoney(avg), tip: "Total spent divided by number of payments" },
  ].forEach((s) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.dataset.tip = s.tip;
    const val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = s.value;
    const label = document.createElement("div");
    label.className = "stat-label";
    label.textContent = s.label;
    card.appendChild(val);
    card.appendChild(label);
    stats.appendChild(card);
  });

  renderTrendChart(inRange, start, end);
  renderBreakdown(document.getElementById("breakdown-category"), inRange, (e) => {
    const cat = e.categoryId ? categoryById(e.categoryId) : null;
    return cat ? { key: cat.name, color: cat.color } : { key: "No category" };
  });
  renderBreakdown(document.getElementById("breakdown-location"), inRange, (e) => ({ key: e.location || "No location" }));
}

function renderTrendChart(inRange, start, end) {
  const chart = document.getElementById("trend-chart");
  chart.innerHTML = "";

  const dayCount = daysBetween(start, end) + 1;
  const totals = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i);
    const total = inRange.filter((e) => e.date === date).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    totals.push({ date, total });
  }
  const max = Math.max(1, ...totals.map((t) => t.total));

  totals.forEach((t) => {
    const bar = document.createElement("div");
    bar.className = "trend-bar";
    bar.dataset.tip = `${formatDateBadge(t.date)}: ${formatMoney(t.total)}`;
    const fill = document.createElement("div");
    fill.className = "trend-bar-fill";
    fill.style.height = `${(t.total / max) * 100}%`;
    bar.appendChild(fill);
    chart.appendChild(bar);
  });
}

function renderBreakdown(container, inRange, groupFn) {
  container.innerHTML = "";
  const totals = new Map();
  const colors = new Map();
  inRange.forEach((e) => {
    const { key, color } = groupFn(e);
    totals.set(key, (totals.get(key) || 0) + (Number(e.amount) || 0));
    if (color) colors.set(key, color);
  });

  if (totals.size === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "No payments in this range";
    container.appendChild(hint);
    return;
  }

  const max = Math.max(...totals.values());
  [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, amount]) => {
      const row = document.createElement("div");
      row.className = "breakdown-row";

      const label = document.createElement("div");
      label.className = "breakdown-label";
      if (colors.has(key)) {
        const dot = document.createElement("span");
        dot.className = "breakdown-dot";
        dot.style.background = colors.get(key);
        label.appendChild(dot);
      }
      label.appendChild(document.createTextNode(key));

      const barWrap = document.createElement("div");
      barWrap.className = "breakdown-bar-wrap";
      const bar = document.createElement("div");
      bar.className = "breakdown-bar";
      bar.style.width = `${(amount / max) * 100}%`;
      if (colors.has(key)) bar.style.background = colors.get(key);
      barWrap.appendChild(bar);

      const amountEl = document.createElement("div");
      amountEl.className = "breakdown-count";
      amountEl.textContent = formatMoney(amount);

      row.appendChild(label);
      row.appendChild(barWrap);
      row.appendChild(amountEl);
      container.appendChild(row);
    });
}

function renderCategoryRow(category, container) {
  const row = document.createElement("div");
  row.className = "category-row";

  const swatch = document.createElement("span");
  swatch.className = "category-swatch";
  swatch.style.background = category.color;
  row.appendChild(swatch);

  const nameWrap = document.createElement("div");
  nameWrap.className = "category-row-name";

  const nameSpan = document.createElement("span");
  nameSpan.textContent = category.name;
  const countSpan = document.createElement("span");
  countSpan.className = "category-row-count";
  const count = categoryCountForEntries(category.id);
  countSpan.textContent = `${count} entr${count === 1 ? "y" : "ies"}`;
  nameWrap.appendChild(nameSpan);
  nameWrap.appendChild(countSpan);

  const actions = document.createElement("div");
  actions.className = "category-row-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.textContent = "Rename";
  editBtn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = category.name;
    input.className = "category-rename-input";
    nameWrap.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const value = input.value.trim();
      if (value) {
        category.name = value;
        touchCategory(category);
        saveCategories(categories);
      }
      render();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") { input.value = category.name; input.blur(); }
    });
  });

  const archiveBtn = document.createElement("button");
  archiveBtn.type = "button";
  archiveBtn.textContent = category.archived ? "Restore" : "Archive";
  archiveBtn.addEventListener("click", () => {
    category.archived = !category.archived;
    touchCategory(category);
    saveCategories(categories);
    render();
  });

  actions.appendChild(editBtn);
  actions.appendChild(archiveBtn);

  row.appendChild(nameWrap);
  row.appendChild(actions);
  container.appendChild(row);
}

function renderCategoriesView() {
  const activeList = document.getElementById("active-categories-list");
  const archivedList = document.getElementById("archived-categories-list");
  activeList.innerHTML = "";
  archivedList.innerHTML = "";

  const active = categories.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name));
  const archived = categories.filter((c) => c.archived).sort((a, b) => a.name.localeCompare(b.name));

  if (active.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "No active categories";
    activeList.appendChild(hint);
  } else {
    active.forEach((c) => renderCategoryRow(c, activeList));
  }

  if (archived.length === 0) {
    const hint = document.createElement("p");
    hint.className = "empty-hint";
    hint.textContent = "No archived categories";
    archivedList.appendChild(hint);
  } else {
    archived.forEach((c) => renderCategoryRow(c, archivedList));
  }
}

function switchView(view) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.getElementById("log-view").hidden = view !== "log";
  document.getElementById("analytics-view").hidden = view !== "analytics";
  document.getElementById("categories-view").hidden = view !== "categories";
  document.getElementById("archive-view").hidden = view !== "archive";
}

function render() {
  renderCurrencySelect();
  renderQaRecentLocations();
  renderQaRecentCategories();
  renderLogView();
  renderArchiveView();
  renderCategoriesView();
  renderRangePicker();
  renderAnalytics();
}

document.getElementById("quick-add").addEventListener("submit", (e) => {
  e.preventDefault();
  const amountRaw = document.getElementById("qa-amount").value;
  const amount = parseFloat(amountRaw);
  const date = document.getElementById("qa-date").value;
  const location = document.getElementById("qa-location").value.trim();
  const comment = document.getElementById("qa-comment").value.trim();
  const categoryRaw = document.getElementById("qa-category").value.trim();
  if (isNaN(amount) || !date) return;
  const categoryId = categoryRaw ? getOrCreateCategoryByName(categoryRaw).id : null;
  addEntry({ date, amount, location, comment, categoryId });
  e.target.reset();
  document.getElementById("qa-date").value = todayStr();
  renderQaRecentLocations();
  renderQaRecentCategories();
});

document.getElementById("qa-date").value = todayStr();
attachCategoryAutocomplete(document.getElementById("qa-category"));
attachLocationAutocomplete(document.getElementById("qa-location"));

document.getElementById("add-category-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("new-category-name");
  const name = input.value.trim();
  if (!name) return;
  getOrCreateCategoryByName(name);
  input.value = "";
  render();
});

document.getElementById("range-start").addEventListener("change", (e) => {
  analyticsRange.start = e.target.value;
  renderAnalytics();
});

document.getElementById("range-end").addEventListener("change", (e) => {
  analyticsRange.end = e.target.value;
  renderAnalytics();
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.getElementById("undo-btn").addEventListener("click", performUndo);
updateUndoButtonState();

document.getElementById("currency-select").addEventListener("change", (e) => {
  setCurrency(e.target.value);
});

const THEME_KEY = "cashreg.theme";

function currentTheme() {
  return localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  document.getElementById("theme-toggle").textContent = theme === "dark" ? "☀️" : "🌙";
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
});

setTheme(currentTheme());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW register failed", e));
  });
}

render();
