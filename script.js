/* ============================================================
   INVOICEFLOW — script.js
   Complete application logic
   ============================================================ */

'use strict';

/* ─── STATE ────────────────────────────────────────────────── */
let invoiceItems = [];
let logoDataURL  = null;
let itemCounter  = 0;

const CURRENCY_MAP = {
  USD: { symbol: '$',     locale: 'en-US',  code: 'USD' },
  EUR: { symbol: '€',     locale: 'de-DE',  code: 'EUR' },
  GBP: { symbol: '£',     locale: 'en-GB',  code: 'GBP' },
  INR: { symbol: '₹',     locale: 'en-IN',  code: 'INR' },
  AED: { symbol: 'AED ',  locale: 'ar-AE',  code: 'AED' },
  CAD: { symbol: 'CA$',   locale: 'en-CA',  code: 'CAD' },
};

/* ─── INIT ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();

  const isGenerator = document.body.classList.contains('gen-page');

  if (isGenerator) {
    initGenerator();
  } else {
    initLanding();
  }
});

/* ============================================================
   SHARED UTILITIES
   ============================================================ */

/* ── Theme ─────────────────────────────────────────────────── */
function loadTheme() {
  const saved = localStorage.getItem('if-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('if-theme', next);
}

/* ── Toast ─────────────────────────────────────────────────── */
function showToast(message, type = 'success', duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent  = message;
  toast.className    = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/* ── Format currency ───────────────────────────────────────── */
function formatCurrency(amount, currencyCode) {
  const c = CURRENCY_MAP[currencyCode] || CURRENCY_MAP['USD'];
  try {
    return new Intl.NumberFormat(c.locale, {
      style:    'currency',
      currency: c.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return c.symbol + parseFloat(amount).toFixed(2);
  }
}

/* ── Format date ───────────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ── Escape HTML ───────────────────────────────────────────── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ── nl2br ─────────────────────────────────────────────────── */
function nl2br(str) {
  return esc(str).replace(/\n/g, '<br>');
}

/* ============================================================
   LANDING PAGE
   ============================================================ */
function initLanding() {
  initNavScroll();
  initScrollReveal();
}

/* ── Nav scroll shadow ─────────────────────────────────────── */
function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ── Mobile nav ────────────────────────────────────────────── */
function toggleMobileNav() {
  const mob = document.getElementById('navMobile');
  if (!mob) return;
  mob.classList.toggle('open');
}

/* ── Scroll reveal ─────────────────────────────────────────── */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
}

/* ── FAQ accordion ─────────────────────────────────────────── */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const wasOpen = item.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));

  // Toggle current
  if (!wasOpen) item.classList.add('open');
}

/* ============================================================
   GENERATOR PAGE
   ============================================================ */
function initGenerator() {
  setDefaultDates();
  generateInvoiceNumber();
  loadDraft();
  addItem(); // Start with one blank item if no draft loaded
  updatePreview();
  initScrollReveal();
}

/* ── Default dates ─────────────────────────────────────────── */
function setDefaultDates() {
  const today = new Date();
  const due   = new Date();
  due.setDate(today.getDate() + 30);

  const fmt = d => d.toISOString().split('T')[0];

  const issueEl = document.getElementById('issueDate');
  const dueEl   = document.getElementById('dueDate');

  if (issueEl && !issueEl.value) issueEl.value = fmt(today);
  if (dueEl   && !dueEl.value)   dueEl.value   = fmt(due);
}

/* ── Auto invoice number ───────────────────────────────────── */
function generateInvoiceNumber() {
  const year  = new Date().getFullYear();
  const seq   = String(Math.floor(Math.random() * 900) + 100);
  const el    = document.getElementById('invoiceNumber');
  if (el) el.value = `INV-${year}-${seq}`;
  updatePreview();
}

/* ── Mobile tab switching ──────────────────────────────────── */
function switchTab(tab) {
  const formPanel    = document.getElementById('genFormPanel');
  const previewPanel = document.getElementById('genPreviewPanel');
  const tabForm      = document.getElementById('tabForm');
  const tabPreview   = document.getElementById('tabPreview');

  if (tab === 'form') {
    formPanel.classList.add('tab-active');
    previewPanel.classList.remove('tab-active');
    tabForm.classList.add('active');
    tabPreview.classList.remove('active');
  } else {
    previewPanel.classList.add('tab-active');
    formPanel.classList.remove('tab-active');
    tabPreview.classList.add('active');
    tabForm.classList.remove('active');
    updatePreview();
  }
}

/* ─────────────────────────────────────────────────────────── */
/*  ITEMS MANAGEMENT                                           */
/* ─────────────────────────────────────────────────────────── */

function addItem(data = {}) {
  const id      = ++itemCounter;
  const taxRate = parseFloat(val('defaultTax')) || 0;

  const item = {
    id,
    description: data.description || '',
    qty:         data.qty         !== undefined ? data.qty   : 1,
    price:       data.price       !== undefined ? data.price : '',
    tax:         data.tax         !== undefined ? data.tax   : taxRate,
  };

  invoiceItems.push(item);
  renderItemRow(item);
  updatePreview();
}

function renderItemRow(item) {
  const list = document.getElementById('itemsList');
  if (!list) return;

  const row = document.createElement('div');
  row.className   = 'item-row';
  row.dataset.id  = item.id;

  row.innerHTML = `
    <input
      type="text"
      class="form-input"
      placeholder="Item description"
      value="${esc(item.description)}"
      oninput="updateItem(${item.id},'description',this.value)"
      aria-label="Description"
    >
    <input
      type="number"
      class="form-input"
      placeholder="1"
      value="${esc(item.qty)}"
      min="0"
      step="any"
      oninput="updateItem(${item.id},'qty',this.value)"
      aria-label="Quantity"
    >
    <input
      type="number"
      class="form-input"
      placeholder="0.00"
      value="${item.price !== '' ? esc(item.price) : ''}"
      min="0"
      step="any"
      oninput="updateItem(${item.id},'price',this.value)"
      aria-label="Unit price"
    >
    <input
      type="number"
      class="form-input"
      placeholder="0"
      value="${esc(item.tax)}"
      min="0"
      max="100"
      step="any"
      oninput="updateItem(${item.id},'tax',this.value)"
      aria-label="Tax %"
    >
    <div class="item-amount" id="itemAmt-${item.id}">—</div>
    <button class="item-del" onclick="removeItem(${item.id})" title="Remove item" aria-label="Remove item">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  list.appendChild(row);
  updateItemAmount(item.id);
}

function updateItem(id, field, value) {
  const item = invoiceItems.find(i => i.id === id);
  if (!item) return;
  item[field] = value;
  updateItemAmount(id);
  updatePreview();
}

function updateItemAmount(id) {
  const item = invoiceItems.find(i => i.id === id);
  if (!item) return;

  const qty    = parseFloat(item.qty)   || 0;
  const price  = parseFloat(item.price) || 0;
  const tax    = parseFloat(item.tax)   || 0;
  const sub    = qty * price;
  const taxAmt = sub * (tax / 100);
  const total  = sub + taxAmt;

  const el = document.getElementById(`itemAmt-${id}`);
  if (el) {
    const curr = val('currency') || 'USD';
    el.textContent = total > 0 ? formatCurrency(total, curr) : '—';
  }
}

function removeItem(id) {
  invoiceItems = invoiceItems.filter(i => i.id !== id);
  const row = document.querySelector(`.item-row[data-id="${id}"]`);
  if (row) {
    row.style.opacity   = '0';
    row.style.transform = 'translateX(-12px)';
    row.style.transition = 'opacity 0.2s, transform 0.2s';
    setTimeout(() => row.remove(), 220);
  }
  updatePreview();
}

/* ─────────────────────────────────────────────────────────── */
/*  CALCULATIONS                                               */
/* ─────────────────────────────────────────────────────────── */

function recalculate() {
  invoiceItems.forEach(item => updateItemAmount(item.id));
  updatePreview();
}

function computeTotals() {
  let subtotal  = 0;
  let taxTotal  = 0;

  invoiceItems.forEach(item => {
    const qty   = parseFloat(item.qty)   || 0;
    const price = parseFloat(item.price) || 0;
    const tax   = parseFloat(item.tax)   || 0;
    const sub   = qty * price;
    const txAmt = sub * (tax / 100);
    subtotal += sub;
    taxTotal += txAmt;
  });

  const grand = subtotal + taxTotal;
  return { subtotal, taxTotal, grand };
}

/* ─────────────────────────────────────────────────────────── */
/*  LOGO                                                       */
/* ─────────────────────────────────────────────────────────── */

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Logo must be under 2MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    logoDataURL = e.target.result;

    const thumb = document.getElementById('logoThumb');
    const ph    = document.getElementById('logoPh');
    const btn   = document.getElementById('removeLogoBtn');

    if (thumb) { thumb.src = logoDataURL; thumb.style.display = 'block'; }
    if (ph)    { ph.style.display = 'none'; }
    if (btn)   { btn.style.display = 'inline-flex'; }

    updatePreview();
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  logoDataURL = null;

  const thumb = document.getElementById('logoThumb');
  const ph    = document.getElementById('logoPh');
  const btn   = document.getElementById('removeLogoBtn');
  const inp   = document.getElementById('logoFile');

  if (thumb) { thumb.src = ''; thumb.style.display = 'none'; }
  if (ph)    { ph.style.display = 'flex'; }
  if (btn)   { btn.style.display = 'none'; }
  if (inp)   { inp.value = ''; }

  updatePreview();
}

/* ─────────────────────────────────────────────────────────── */
/*  HELPER: read form field value                              */
/* ─────────────────────────────────────────────────────────── */

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/* ─────────────────────────────────────────────────────────── */
/*  LIVE PREVIEW RENDERER                                      */
/* ─────────────────────────────────────────────────────────── */

function updatePreview() {
  const preview = document.getElementById('invoicePreview');
  if (!preview) return;

  const currency   = val('currency') || 'USD';
  const totals     = computeTotals();
  const hasItems   = invoiceItems.some(i => i.description || i.price);
  const hasContent = val('fromName') || val('toName') || hasItems;

  if (!hasContent) {
    preview.innerHTML = buildEmptyState();
    return;
  }

  preview.innerHTML = buildInvoiceHTML({ currency, totals });
}

function buildEmptyState() {
  return `
    <div class="inv-body inv-placeholder-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
      <h3>Your invoice preview</h3>
      <p>Fill in the form on the left to see your professional invoice update live here.</p>
    </div>
  `;
}

function buildInvoiceHTML({ currency, totals }) {
  const fromName    = val('fromName');
  const fromAddress = val('fromAddress');
  const fromEmail   = val('fromEmail');
  const fromPhone   = val('fromPhone');
  const fromTaxId   = val('fromTaxId');
  const toName      = val('toName');
  const toAddress   = val('toAddress');
  const toEmail     = val('toEmail');
  const toPhone     = val('toPhone');
  const invNumber   = val('invoiceNumber');
  const issueDate   = val('issueDate');
  const dueDate     = val('dueDate');
  const notes       = val('invoiceNotes');
  const payment     = val('paymentTerms');

  // --- Logo block ---
  const logoHTML = logoDataURL
    ? `<img src="${logoDataURL}" class="inv-logo" alt="Logo">`
    : '';

  // --- From contact ---
  const contactParts = [fromEmail, fromPhone].filter(Boolean);
  const fromContactHTML = contactParts.length
    ? `<div class="inv-company-contact">${esc(contactParts.join('  ·  '))}</div>`
    : '';
  const fromTaxHTML = fromTaxId
    ? `<div class="inv-company-taxid">${esc(fromTaxId)}</div>`
    : '';

  // --- To contact ---
  const toContactParts = [toEmail, toPhone].filter(Boolean);
  const toContactHTML = toContactParts.length
    ? `<div class="inv-client-contact">${esc(toContactParts.join('  ·  '))}</div>`
    : '';

  // --- Items rows ---
  const itemRowsHTML = invoiceItems.map(item => {
    const qty   = parseFloat(item.qty)   || 0;
    const price = parseFloat(item.price) || 0;
    const tax   = parseFloat(item.tax)   || 0;
    const sub   = qty * price;
    const txAmt = sub * (tax / 100);
    const total = sub + txAmt;

    const taxLabel = tax > 0 ? `<br><small style="color:#8892AA;font-size:11px">Tax ${tax}%</small>` : '';

    return `
      <tr>
        <td class="desc-cell">${nl2br(item.description) || '<em style="opacity:.4">—</em>'}${taxLabel}</td>
        <td>${qty || '—'}</td>
        <td>${price ? formatCurrency(price, currency) : '—'}</td>
        <td class="amount-cell">${total > 0 ? formatCurrency(total, currency) : '—'}</td>
      </tr>
    `;
  }).join('');

  // --- Totals block ---
  const showTax   = totals.taxTotal > 0;
  const taxRowHTML = showTax
    ? `<div class="inv-total-row"><span>Tax</span><span>${formatCurrency(totals.taxTotal, currency)}</span></div>`
    : '';

  // --- Notes/payment block ---
  const hasNotes   = notes || payment;
  const notesHTML  = hasNotes ? `
    <div class="inv-notes-section">
      ${notes ? `
        <div class="inv-notes-block">
          <div class="inv-meta-label">Notes</div>
          <div class="inv-notes-text">${nl2br(notes)}</div>
        </div>` : ''}
      ${payment ? `
        <div class="inv-notes-block">
          <div class="inv-meta-label">Payment Details</div>
          <div class="inv-notes-text">${nl2br(payment)}</div>
        </div>` : ''}
    </div>
  ` : '';

  return `
    <div class="inv-accent-bar"></div>
    <div class="inv-body">

      <!-- HEADER -->
      <div class="inv-header">
        <div class="inv-from-block">
          ${logoHTML}
          <div class="inv-from-info">
            ${fromName    ? `<div class="inv-company-name">${esc(fromName)}</div>` : ''}
            ${fromAddress ? `<div class="inv-company-addr">${nl2br(fromAddress)}</div>` : ''}
            ${fromContactHTML}
            ${fromTaxHTML}
          </div>
        </div>
        <div class="inv-title-block">
          <div class="inv-title">INVOICE</div>
          ${invNumber ? `<div class="inv-number">${esc(invNumber)}</div>` : ''}
        </div>
      </div>

      <div class="inv-divider"></div>

      <!-- META ROW: Bill To + Dates -->
      <div class="inv-meta-row">
        <div class="inv-bill-to">
          <div class="inv-meta-label">Bill To</div>
          ${toName    ? `<div class="inv-client-name">${esc(toName)}</div>` : ''}
          ${toAddress ? `<div class="inv-client-addr">${nl2br(toAddress)}</div>` : ''}
          ${toContactHTML}
        </div>
        <div class="inv-dates">
          ${issueDate ? `
            <div class="inv-date-block">
              <div class="inv-meta-label">Issue Date</div>
              <div class="inv-date-val">${formatDate(issueDate)}</div>
            </div>` : ''}
          ${dueDate ? `
            <div class="inv-date-block">
              <div class="inv-meta-label">Due Date</div>
              <div class="inv-date-val" style="color:#4F46E5;font-weight:700">${formatDate(dueDate)}</div>
            </div>` : ''}
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <table class="inv-table">
        <thead>
          <tr>
            <th style="width:45%">Description</th>
            <th style="width:10%;text-align:right">Qty</th>
            <th style="width:18%;text-align:right">Rate</th>
            <th style="width:18%;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHTML || `<tr><td colspan="4" style="text-align:center;padding:28px;color:#8892AA;font-style:italic">Add items using the form</td></tr>`}
        </tbody>
      </table>

      <!-- TOTALS -->
      <div class="inv-totals-wrap">
        <div class="inv-totals-table">
          <div class="inv-total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(totals.subtotal, currency)}</span>
          </div>
          ${taxRowHTML}
          <div class="inv-grand-row">
            <span>Total Due</span>
            <span>${formatCurrency(totals.grand, currency)}</span>
          </div>
        </div>
      </div>

    </div>

    ${notesHTML}

    <div class="inv-footer">
      <div class="inv-thank-you">Thank you for your business</div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────── */
/*  SAVE / LOAD DRAFT                                          */
/* ─────────────────────────────────────────────────────────── */

function collectFormData() {
  return {
    fromName:      val('fromName'),
    fromAddress:   val('fromAddress'),
    fromEmail:     val('fromEmail'),
    fromPhone:     val('fromPhone'),
    fromTaxId:     val('fromTaxId'),
    toName:        val('toName'),
    to
