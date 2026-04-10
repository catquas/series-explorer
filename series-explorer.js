/* ─────────────────────────────────────────────
   series-explorer.js
   Interactivity for series-explorer-template5

   Depends on two globals injected inline by the
   Jinja2 template before this script loads:
     MONTHS  — array of 21 month label strings
     NAV     — nav structure parsed from nav_links.csv
   ───────────────────────────────────────────── */

/* ── Index sets used throughout ── */
const IDX_2025    = new Set([0,1,2,3,4,5,6,7,8,9,10,11]); // Jan–Dec 2025
const IDX_Q1_2025 = new Set([0,1,2]);                       // Jan–Mar 2025
const IDX_FUTURE  = new Set([18,19,20]);                    // Jul–Sep 2026 (shown as —)

/* ── Column indices for the filter dropdown ── */
const COL_DESC = 1;
const COL_CAT  = MONTHS.length + 2; // cb(0) + desc(1) + months + cat

/* ── Nav state ── */
let activeCat    = NAV[0].id;
let activeSubcat = NAV.find(c => c.subcats)?.subcats[0].id ?? '';
let activePage   = (NAV[0].pages ?? NAV[0].subcats[0].pages)[0].name;

/* ── UI state ── */
let viewMode  = 'actuals'; // 'actuals' | 'mom' (month-over-month)
let chartInst = null;

/* ── Column filter state ── */
const activeFilters  = {};           // colIdx → Set of allowed values
let currentColIdx    = null;
let pendingSelection = new Set();


/* ═══════════════════════════════════════════
   THEME
═══════════════════════════════════════════ */

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  const btn = document.getElementById('themeToggle');
  btn.textContent = next === 'dark' ? '☽' : '☀';
  btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  updateChart();
}

function getTickColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? '#8a9ab5' : '#6b7280';
}
function getGridColor() {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}


/* ═══════════════════════════════════════════
   NAV RENDERING
   Builds catBar / subcatBar DOM from the NAV
   constant. Called on load and on every click.
═══════════════════════════════════════════ */

function getPagesForCurrent() {
  const cat = NAV.find(c => c.id === activeCat);
  if (!cat) return [];
  if (cat.subcats) return cat.subcats.find(s => s.id === activeSubcat)?.pages ?? cat.subcats[0].pages;
  return cat.pages;
}

/* Returns [separator div, page-link strip] for appending to a nav bar */
function buildPageLinks(pages) {
  const sep  = document.createElement('div');
  sep.className = 'page-links-sep';
  const wrap = document.createElement('div');
  wrap.className = 'page-links';
  pages.forEach(pg => {
    const a = document.createElement('a');
    a.className   = 'page-link' + (pg.name === activePage ? ' active' : '');
    a.textContent = pg.name;
    a.href        = pg.link;
    if (pg.link === '#') a.addEventListener('click', e => e.preventDefault());
    a.addEventListener('click', () => { activePage = pg.name; renderNav(); });
    wrap.appendChild(a);
  });
  return [sep, wrap];
}

function renderNav() {
  const catBar  = document.getElementById('catBar');
  const subBar  = document.getElementById('subcatBar');
  const catDef  = NAV.find(c => c.id === activeCat);
  const hasSubs = !!(catDef?.subcats);
  const pages   = getPagesForCurrent();

  /* Category tabs */
  catBar.innerHTML = '';
  const tabs = document.createElement('div');
  tabs.className = 'cat-tabs';
  NAV.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat.id === activeCat ? ' active' : '');
    btn.textContent = cat.label;
    btn.setAttribute('aria-pressed', String(cat.id === activeCat));
    btn.setAttribute('aria-label',   cat.label + ' category');
    if (cat.id === activeCat) btn.setAttribute('aria-current', 'true');
    btn.addEventListener('click', () => {
      activeCat  = cat.id;
      if (cat.subcats) activeSubcat = cat.subcats[0].id;
      activePage = (cat.pages ?? cat.subcats[0].pages)[0].name;
      renderNav();
    });
    tabs.appendChild(btn);
  });
  catBar.appendChild(tabs);

  /* Page links go in catBar when there are no subcats */
  if (!hasSubs) catBar.append(...buildPageLinks(pages));

  /* Subcategory bar — only visible for categories that have subcats */
  subBar.classList.toggle('hidden', !hasSubs);
  if (hasSubs) {
    subBar.innerHTML = '';
    const scTabs = document.createElement('div');
    scTabs.className = 'subcat-tabs';
    catDef.subcats.forEach(sc => {
      const btn = document.createElement('button');
      btn.className = 'subcat-tab' + (sc.id === activeSubcat ? ' active' : '');
      btn.textContent = sc.label;
      btn.setAttribute('aria-pressed', String(sc.id === activeSubcat));
      btn.setAttribute('aria-label',   sc.label + ' subcategory');
      if (sc.id === activeSubcat) btn.setAttribute('aria-current', 'true');
      btn.addEventListener('click', () => {
        activeSubcat = sc.id;
        activePage   = catDef.subcats.find(s => s.id === activeSubcat).pages[0].name;
        renderNav();
      });
      scTabs.appendChild(btn);
    });
    subBar.appendChild(scTabs);
    subBar.append(...buildPageLinks(pages));
  }

  /* Update page title and breadcrumb */
  document.getElementById('nav-page-title').textContent = activePage;
  document.getElementById('nav-page-sub').textContent   = hasSubs
    ? `${catDef.label} › ${catDef.subcats.find(s => s.id === activeSubcat)?.label} › ${activePage}`
    : `${catDef?.label} › ${activePage}`;
}


/* ═══════════════════════════════════════════
   ROW EXPAND / COLLAPSE
   group IDs and aria-controls are baked in by
   Jinja2, so we only need to toggle classes.
═══════════════════════════════════════════ */

/* Toggle a parent row's direct children */
function toggleRow(rowIdx, btn) {
  const expanding = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(expanding));
  document.querySelectorAll(`tr.sub-row[data-group="grp-${rowIdx}"]`).forEach(child => {
    child.classList.toggle('sub-hidden', !expanding);
    if (!expanding) {
      /* Collapsing: also reset any open grandchildren */
      const ci = child.dataset.childIdx;
      document.querySelectorAll(`tr.sub-row[data-group="grp-${rowIdx}-${ci}"]`)
              .forEach(gc => gc.classList.add('sub-hidden'));
      const cBtn = document.getElementById(`expand-${rowIdx}-${ci}`);
      if (cBtn) cBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* Toggle a child row's grandchildren */
function toggleChild(rowIdx, childIdx, btn) {
  const expanding = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(expanding));
  document.querySelectorAll(`tr.sub-row[data-group="grp-${rowIdx}-${childIdx}"]`)
          .forEach(gc => gc.classList.toggle('sub-hidden', !expanding));
}

function expandAll() {
  /* Expand parents first so children exist in the DOM, then expand children */
  document.querySelectorAll('tr.data-row .expand-btn[aria-expanded="false"]').forEach(b => b.click());
  document.querySelectorAll('tr.sub-row  .expand-btn[aria-expanded="false"]').forEach(b => b.click());
}

function collapseAll() {
  /* toggleRow already collapses grandchildren, so collapsing parents is enough */
  document.querySelectorAll('tr.data-row .expand-btn[aria-expanded="true"]').forEach(b => b.click());
}


/* ═══════════════════════════════════════════
   VALUE FORMATTING
   Used for the initial render (actuals) and
   re-applied by toggleViewMode() on every cell.
═══════════════════════════════════════════ */

/* A cell is "degraded" if its category downgrades that month */
function isDegraded(cat, mi) {
  if (cat === '2025')  return IDX_2025.has(mi);
  if (cat === 'Splice') return IDX_Q1_2025.has(mi);
  return false;
}

/* Month-over-month change vs the closest prior non-null value */
function momVal(vals, mi) {
  if (IDX_FUTURE.has(mi) || vals[mi] === null) return null;
  for (let j = mi - 1; j >= 0; j--) if (vals[j] !== null) return +(vals[mi] - vals[j]).toFixed(2);
  return null;
}

function getDisplayVal(vals, mi) {
  return viewMode === 'mom' ? momVal(vals, mi)
       : IDX_FUTURE.has(mi) ? null : vals[mi];
}

function fmtDisplayVal(vals, mi) {
  const v = getDisplayVal(vals, mi);
  if (v === null) return '—';
  if (viewMode === 'mom') return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toFixed(1) + 'M';
  return (v < 0 ? '−' : '') + '$' + Math.abs(v).toFixed(1) + 'M';
}

function displayValCls(vals, mi) {
  const v = getDisplayVal(vals, mi);
  if (v === null) return 'val-fut';
  if (viewMode === 'mom') return v > 0 ? 'val-pos' : v < 0 ? 'val-neg' : 'val-neu';
  return v >= 5.5 ? 'val-pos' : v < 3.0 ? 'val-neg' : 'val-neu';
}

/* Re-colour the 21 month cells in one row after a view-mode change */
function refreshCells(tr, vals, cat) {
  tr.querySelectorAll('td.month-cell').forEach((td, mi) => {
    const dg  = isDegraded(cat, mi);
    const txt = fmtDisplayVal(vals, mi);
    td.textContent = txt;
    td.className   = 'month-cell';
    if (dg) {
      td.classList.add('val-dg');
      td.title = `${MONTHS[mi]}: downgraded (${cat} category)`;
    } else {
      td.classList.add(displayValCls(vals, mi));
      td.title = '';
    }
    td.setAttribute('aria-label', `${MONTHS[mi]}: ${txt}${dg ? ' (downgraded)' : ''}`);
  });
}

function toggleViewMode() {
  viewMode = viewMode === 'actuals' ? 'mom' : 'actuals';
  const btn   = document.getElementById('viewToggleBtn');
  const isMom = viewMode === 'mom';
  btn.setAttribute('aria-pressed', String(isMom));
  btn.innerHTML = isMom
    ? '<span class="btn-view-icon" aria-hidden="true">Δ</span> MoM Change'
    : '<span class="btn-view-icon" aria-hidden="true">≡</span> Actuals';
  btn.setAttribute('aria-label', isMom
    ? 'Currently showing Month-over-Month change. Click to switch to Actuals.'
    : 'Currently showing Actuals. Click to switch to Month-over-Month change.');
  /* Re-render every row's cells from their stored data-vals */
  document.querySelectorAll('tr.data-row, tr.sub-row').forEach(tr =>
    refreshCells(tr, JSON.parse(tr.dataset.vals), tr.dataset.cat)
  );
  updateChart();
}


/* ═══════════════════════════════════════════
   FILTERS
   Single applyFilters() handles both the
   dropdown selects and the column filters.
═══════════════════════════════════════════ */

/* Read a filterable value from a row's data attributes */
function getCellText(tr, colIdx) {
  if (colIdx === COL_DESC) return tr.dataset.name;
  if (colIdx === COL_CAT)  return tr.dataset.cat;
  return '';
}

/* Unique sorted values for a column (populates the filter dropdown list) */
function getUniqueValues(colIdx) {
  const seen = new Set();
  document.querySelectorAll('tr.data-row').forEach(tr => seen.add(getCellText(tr, colIdx)));
  return [...seen].sort();
}

function applyFilters() {
  const state    = document.getElementById('sel-state').value;
  const metro    = document.getElementById('sel-metro').value;
  const industry = document.getElementById('sel-industry').value;
  let visible = 0;

  document.querySelectorAll('tr.data-row').forEach(tr => {
    /* Check the three dropdown selects */
    const passDropdown =
      (!state    || tr.dataset.state    === state)    &&
      (!metro    || tr.dataset.metro    === metro)    &&
      (!industry || tr.dataset.industry === industry);

    /* Check any active column filters (Account name / Category chip) */
    let passColumn = true;
    for (const [k, allowed] of Object.entries(activeFilters)) {
      if (!allowed?.size) continue;
      if (!allowed.has(getCellText(tr, parseInt(k)))) { passColumn = false; break; }
    }

    const show = passDropdown && passColumn;
    tr.classList.toggle('filtered-out', !show);
    if (show) visible++;

    /* Children and grandchildren inherit their parent's visibility */
    document.querySelectorAll(`tr[data-parent-idx="${tr.dataset.rowIdx}"]`)
            .forEach(c => c.classList.toggle('filtered-out', !show));
  });

  document.getElementById('rowCountBadge').textContent = visible + ' rows';
  document.getElementById('clearFiltersBtn').classList.toggle(
    'hidden', !Object.values(activeFilters).some(s => s?.size > 0)
  );
  updateSelectAll();
  updateChart();
}


/* ═══════════════════════════════════════════
   COLUMN FILTER DROPDOWN
═══════════════════════════════════════════ */

/* Highlight the ▾ button for columns that have an active filter */
function updateFilterButtons() {
  document.querySelectorAll('thead .filter-btn[data-col]').forEach(btn => {
    const col = parseInt(btn.dataset.col);
    btn.classList.toggle('active', !!(activeFilters[col]?.size > 0));
  });
}

function openFilter(e, colIdx) {
  if (colIdx !== COL_DESC && colIdx !== COL_CAT) return;
  e.stopPropagation();
  const dd = document.getElementById('filterDropdown');
  /* Toggle closed if clicking the same column again */
  if (currentColIdx === colIdx && dd.classList.contains('open')) { closeDropdown(); return; }
  currentColIdx    = colIdx;
  const allVals    = getUniqueValues(colIdx);
  pendingSelection = activeFilters[colIdx] ? new Set(activeFilters[colIdx]) : new Set(allVals);
  document.getElementById('fdSearch').value = '';
  renderFdList(allVals);
  /* Position the dropdown below the clicked button */
  const rect = e.currentTarget.getBoundingClientRect();
  dd.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  dd.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
  dd.classList.add('open');
  setTimeout(() => document.getElementById('fdSearch').focus(), 50);
}

function closeDropdown() {
  document.getElementById('filterDropdown').classList.remove('open');
  currentColIdx = null;
}

/* Render checkbox list inside the dropdown */
function renderFdList(vals) {
  const list = document.getElementById('fdList');
  list.innerHTML = '';
  vals.forEach(v => {
    const item = document.createElement('div');
    item.className = 'fd-item';
    const cb  = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = pendingSelection.has(v);
    const lbl  = document.createElement('span');
    lbl.className   = 'fd-item-label';
    lbl.textContent = v;
    item.append(cb, lbl);
    item.addEventListener('click', e => {
      if (e.target !== cb) cb.checked = !cb.checked; // avoid double-toggle on checkbox clicks
      cb.checked ? pendingSelection.add(v) : pendingSelection.delete(v);
    });
    list.appendChild(item);
  });
}

function filterDropdownSearch() {
  const q = document.getElementById('fdSearch').value.toLowerCase();
  renderFdList(getUniqueValues(currentColIdx).filter(v => v.toLowerCase().includes(q)));
}

function fdSelectAll() {
  const q = document.getElementById('fdSearch').value.toLowerCase();
  getUniqueValues(currentColIdx).filter(v => v.toLowerCase().includes(q))
    .forEach(v => pendingSelection.add(v));
  filterDropdownSearch();
}

function fdClearAll() {
  const q = document.getElementById('fdSearch').value.toLowerCase();
  getUniqueValues(currentColIdx).filter(v => v.toLowerCase().includes(q))
    .forEach(v => pendingSelection.delete(v));
  filterDropdownSearch();
}

function applyDropdownFilter() {
  const allVals = getUniqueValues(currentColIdx);
  /* If everything is selected, remove the filter entirely */
  if (pendingSelection.size >= allVals.length) delete activeFilters[currentColIdx];
  else activeFilters[currentColIdx] = new Set(pendingSelection);
  updateFilterButtons();
  applyFilters();
  closeDropdown();
}

function clearAllFilters() {
  Object.keys(activeFilters).forEach(k => delete activeFilters[k]);
  updateFilterButtons();
  applyFilters();
}

/* Close dropdown when clicking anywhere outside it */
document.addEventListener('click', e => {
  if (!document.getElementById('filterDropdown').contains(e.target)) closeDropdown();
});


/* ═══════════════════════════════════════════
   CHECKBOXES
═══════════════════════════════════════════ */

/* Master checkbox: check/uncheck all visible, non-hidden rows */
function toggleSelectAll(masterCb) {
  document.querySelectorAll('.row-cb, .child-cb, .grandchild-cb').forEach(cb => {
    const tr = cb.closest('tr');
    if (tr && !tr.classList.contains('filtered-out') && !tr.classList.contains('sub-hidden'))
      cb.checked = masterCb.checked;
  });
}

/* Sync master checkbox state from individual row checkboxes */
function updateSelectAll() {
  const all     = [...document.querySelectorAll('.row-cb')]
                   .filter(cb => !cb.closest('tr').classList.contains('filtered-out'));
  const checked = all.filter(cb => cb.checked);
  const master  = document.getElementById('selectAll');
  if (!master) return;
  master.checked       = checked.length === all.length && all.length > 0;
  master.indeterminate = checked.length > 0 && checked.length < all.length;
}


/* ═══════════════════════════════════════════
   CHART
═══════════════════════════════════════════ */

/* Sum the vals of all checked, non-filtered parent rows */
function getCheckedSums() {
  const sums = MONTHS.map(() => 0);
  let any = false;
  document.querySelectorAll('tr.data-row').forEach(tr => {
    if (tr.classList.contains('filtered-out')) return;
    if (!tr.querySelector('.row-cb')?.checked) return;
    any = true;
    JSON.parse(tr.dataset.vals).forEach((v, mi) => { if (v !== null) sums[mi] += v; });
  });
  if (!any) return null;
  return sums.map((s, mi) => IDX_FUTURE.has(mi) ? null : +s.toFixed(2));
}

function updateChart() {
  const data  = getCheckedSums();
  const noSel = !data;
  const plot  = data ?? MONTHS.map((_, mi) => IDX_FUTURE.has(mi) ? null : 0);

  /* Pad y-axis range so the line has breathing room */
  let yMin = 0, yMax = 10;
  if (data) {
    const vals = data.filter(v => v !== null);
    if (vals.length) {
      const pad = Math.max((Math.max(...vals) - Math.min(...vals)) * 0.15, Math.max(...vals) * 0.05, 0.5);
      yMin = Math.max(0, Math.min(...vals) - pad);
      yMax = Math.max(...vals) + pad;
    }
  }

  const tick = getTickColor(), grid = getGridColor();
  if (chartInst) chartInst.destroy();
  chartInst = new Chart(document.getElementById('mainChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [{
        label: 'Sum of selected rows',
        data: plot,
        borderColor:          noSel ? 'rgba(138,154,181,0.3)' : '#3d8ef0',
        backgroundColor:      noSel ? 'rgba(138,154,181,0.04)' : 'rgba(61,142,240,0.08)',
        pointBackgroundColor: noSel ? 'rgba(138,154,181,0.3)' : '#3d8ef0',
        pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
        tension: 0.35, fill: true, spanGaps: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          callbacks: { label: ctx => noSel ? 'No rows selected' : 'Total: $' + ctx.parsed.y.toFixed(2) + 'M' },
        },
      },
      scales: {
        x: { grid: { color: grid }, ticks: { color: tick, font: { size: 9 }, maxRotation: 50, autoSkip: false } },
        y: { min: +yMin.toFixed(2), max: +yMax.toFixed(2),
             grid: { color: grid }, ticks: { color: tick, font: { size: 10 }, callback: v => '$' + v.toFixed(1) + 'M' } },
      },
    },
  });

  /* Update the chart card title to reflect selection count */
  const n = data
    ? document.querySelectorAll('tr.data-row:not(.filtered-out) .row-cb:checked').length
    : 0;
  document.getElementById('chart-title').textContent = n > 0
    ? `Sum of ${n} selected row${n === 1 ? '' : 's'} — Jan 2025 to Sep 2026`
    : 'No rows selected — check rows below to plot their sum';
}


/* ── Init ── */
renderNav();
updateChart();
