/* ============================================================
   InvoiceFlow — script.js  (fixed)
   Fixes: generate invoice number, download/export PDF,
          live preview updates, Edit/Preview navigation,
          logo upload, save draft, reset, print, add/remove items
   ============================================================ */

(function () {
  'use strict';

  /* ── Currency config ─────────────────────────────────────── */
  const CURRENCIES = {
    USD: { symbol: '$',   locale: 'en-US', code: 'USD' },
    EUR: { symbol: '€',   locale: 'de-DE', code: 'EUR' },
    GBP: { symbol: '£',   locale: 'en-GB', code: 'GBP' },
    INR: { symbol: '₹',   locale: 'en-IN', code: 'INR' },
    AED: { symbol: 'AED', locale: 'ar-AE', code: 'AED' },
    CAD: { symbol: 'CA$', locale: 'en-CA', code: 'CAD' },
  };

  /* ── State ───────────────────────────────────────────────── */
  let logoDataURL = null;
  let itemCount   = 0;

  /* ── Helpers ─────────────────────────────────────────────── */
  function fmt(amount, currencyCode) {
    const c = CURRENCIES[currencyCode] || CURRENCIES.USD;
    try {
      return new Intl.NumberFormat(c.locale, {
        style: 'currency', currency: c.code, minimumFractionDigits: 2,
      }).format(amount);
    } catch (_) {
      return c.symbol + Number(amount).toFixed(2);
    }
  }

  function generateInvoiceNumber() {
    const year  = new Date().getFullYear();
    const seq   = String(Math.floor(Math.random() * 9000) + 1000);
    return `INV-${year}-${seq}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* ── DOM references ──────────────────────────────────────── */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  /* ── Tab navigation (Edit / Preview) ────────────────────── */
  function initTabs() {
    const btnEdit    = $('#btn-edit,   .tab-edit,   [data-tab="edit"],    button:has-text');
    const btnPreview = $('#btn-preview, .tab-preview, [data-tab="preview"]');

    // Find tab buttons by text content if no ID/class match
    const allBtns = $$('button, [role="tab"]');
    let editBtn    = allBtns.find(b => /^edit$/i.test(b.textContent.trim()));
    let previewBtn = allBtns.find(b => /^preview$/i.test(b.textContent.trim()));

    const editorPane  = $('#editor-pane,  .editor-pane,  .form-side,  [data-pane="edit"]')
                      || $('.generator-form') || $('form') || $('.left-panel');
    const previewPane = $('#preview-pane, .preview-pane, .invoice-preview, [data-pane="preview"]')
                      || $('.preview-side') || $('.right-panel') || $('.invoice-panel');

    if (!editBtn || !previewBtn) return; // tabs not found by text — skip

    function showEdit() {
      editBtn.classList.add('active');
      previewBtn.classList.remove('active');
      if (editorPane)  editorPane.style.display  = '';
      if (previewPane) previewPane.style.display  = 'none';
    }

    function showPreview() {
      previewBtn.classList.add('active');
      editBtn.classList.remove('active');
      if (editorPane)  editorPane.style.display  = 'none';
      if (previewPane) previewPane.style.display  = '';
      updatePreview();
    }

    editBtn.addEventListener('click',    showEdit);
    previewBtn.addEventListener('click', showPreview);
  }

  /* ── Mobile tab navigation (data-tab attributes) ─────────── */
  function initDataTabs() {
    $$('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        $$('[data-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('[data-pane]').forEach(pane => {
          pane.classList.toggle('hidden',  pane.dataset.pane !== target);
          pane.classList.toggle('visible', pane.dataset.pane === target);
        });
        if (target === 'preview') updatePreview();
      });
    });
  }

  /* ── Line items ──────────────────────────────────────────── */
  function getDefaultTax() {
    const el = $('#default-tax, #defaultTax, [name="defaultTax"], [data-field="defaultTax"]');
    return el ? parseFloat(el.value) || 0 : 0;
  }

  function calcItemAmount(qty, price, taxPct) {
    const sub = (parseFloat(qty) || 0) * (parseFloat(price) || 0);
    return sub + sub * (parseFloat(taxPct) / 100 || 0);
  }

  function buildItemRow(id) {
    const tax = getDefaultTax();
    const tr  = document.createElement('tr');
    tr.dataset.itemId = id;
    tr.innerHTML = `
      <td><input type="text"   class="item-desc"   placeholder="Description" /></td>
      <td><input type="number" class="item-qty"    value="1"   min="0" step="any" /></td>
      <td><input type="number" class="item-price"  value="0"   min="0" step="any" /></td>
      <td><input type="number" class="item-tax"    value="${tax}" min="0" step="any" /></td>
      <td class="item-amount">0.00</td>
      <td><button type="button" class="btn-remove-item" title="Remove">×</button></td>`;

    tr.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => { recalcRow(tr); updatePreview(); });
    });
    tr.querySelector('.btn-remove-item').addEventListener('click', () => {
      tr.remove();
      updateTotals();
      updatePreview();
    });
    return tr;
  }

  function recalcRow(tr) {
    const qty   = tr.querySelector('.item-qty')?.value   || 0;
    const price = tr.querySelector('.item-price')?.value || 0;
    const tax   = tr.querySelector('.item-tax')?.value   || 0;
    const cur   = getCurrency();
    const amt   = calcItemAmount(qty, price, tax);
    const cell  = tr.querySelector('.item-amount');
    if (cell) cell.textContent = fmt(amt, cur);
    updateTotals();
  }

  function getCurrency() {
    const sel = $('#currency, [name="currency"], select[data-field="currency"]');
    return sel ? sel.value : 'USD';
  }

  function getItemsTableBody() {
    return $('#items-tbody, #invoice-items tbody, .items-table tbody, table.items tbody')
        || (() => {
             const tbl = $('table');
             return tbl ? tbl.querySelector('tbody') : null;
           })();
  }

  function addItem() {
    const tbody = getItemsTableBody();
    if (!tbody) return;
    itemCount++;
    tbody.appendChild(buildItemRow(itemCount));
    updatePreview();
  }

  function updateTotals() {
    const cur     = getCurrency();
    let subtotal  = 0;
    let taxTotal  = 0;

    $$('tr[data-item-id]').forEach(tr => {
      const qty   = parseFloat(tr.querySelector('.item-qty')?.value)   || 0;
      const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
      const tax   = parseFloat(tr.querySelector('.item-tax')?.value)   || 0;
      const sub   = qty * price;
      subtotal   += sub;
      taxTotal   += sub * (tax / 100);
    });

    const total = subtotal + taxTotal;
    const set   = (sel, val) => { const el = $(sel); if (el) el.textContent = val; };

    set('#subtotal, .subtotal-val, [data-total="subtotal"]', fmt(subtotal, cur));
    set('#tax-total, .tax-val,     [data-total="tax"]',      fmt(taxTotal, cur));
    set('#grand-total, .total-val, [data-total="total"]',    fmt(total,    cur));
  }

  /* ── Read form data ──────────────────────────────────────── */
  function getFieldVal(selectors) {
    for (const sel of selectors) {
      const el = $(sel);
      if (el) return el.value || el.textContent || '';
    }
    return '';
  }

  function getFormData() {
    const cur = getCurrency();

    const items = $$('tr[data-item-id]').map(tr => {
      const qty   = parseFloat(tr.querySelector('.item-qty')?.value)   || 0;
      const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
      const tax   = parseFloat(tr.querySelector('.item-tax')?.value)   || 0;
      return {
        desc:   tr.querySelector('.item-desc')?.value || '',
        qty, price, tax,
        amount: calcItemAmount(qty, price, tax),
      };
    });

    let subtotal = 0, taxTotal = 0;
    items.forEach(i => {
      const sub = i.qty * i.price;
      subtotal  += sub;
      taxTotal  += sub * (i.tax / 100);
    });

    return {
      // Sender
      bizName:    getFieldVal(['#biz-name,    [name="bizName"],    [data-field="bizName"]'   .split(',')].flat()),
      bizAddress: getFieldVal(['#biz-address, [name="bizAddress"], [data-field="bizAddress"]'.split(',')].flat()),
      bizEmail:   getFieldVal(['#biz-email,   [name="bizEmail"],   [data-field="bizEmail"]'  .split(',')].flat()),
      bizPhone:   getFieldVal(['#biz-phone,   [name="bizPhone"],   [data-field="bizPhone"]'  .split(',')].flat()),
      bizTaxId:   getFieldVal(['#biz-taxid,   [name="bizTaxId"],   [data-field="bizTaxId"]'  .split(',')].flat()),
      // Client
      clientName:    getFieldVal(['#client-name,    [name="clientName"],    [data-field="clientName"]'   .split(',')].flat()),
      clientAddress: getFieldVal(['#client-address, [name="clientAddress"], [data-field="clientAddress"]'.split(',')].flat()),
      clientEmail:   getFieldVal(['#client-email,   [name="clientEmail"],   [data-field="clientEmail"]'  .split(',')].flat()),
      clientPhone:   getFieldVal(['#client-phone,   [name="clientPhone"],   [data-field="clientPhone"]'  .split(',')].flat()),
      // Invoice meta
      invoiceNum:  getFieldVal(['#invoice-number, [name="invoiceNumber"], [data-field="invoiceNumber"]'.split(',')].flat()),
      issueDate:   getFieldVal(['#issue-date,     [name="issueDate"],     [data-field="issueDate"]'     .split(',')].flat()),
      dueDate:     getFieldVal(['#due-date,        [name="dueDate"],       [data-field="dueDate"]'      .split(',')].flat()),
      currency:    cur,
      // Items & totals
      items,
      subtotal, taxTotal, total: subtotal + taxTotal,
      // Notes
      notes:       getFieldVal(['#notes,        [name="notes"],        [data-field="notes"]'       .split(',')].flat()),
      bankInfo:    getFieldVal(['#bank-info,     [name="bankInfo"],     [data-field="bankInfo"]'    .split(',')].flat()),
    };
  }

  /* ── Live preview builder ────────────────────────────────── */
  function getPreviewContainer() {
    return $('#invoice-preview, .invoice-preview, #preview-content, .preview-content, [data-pane="preview"]');
  }

  function updatePreview() {
    const container = getPreviewContainer();
    if (!container) return;

    const d   = getFormData();
    const cur = d.currency;
    const c   = CURRENCIES[cur] || CURRENCIES.USD;

    const logoHTML = logoDataURL
      ? `<img src="${logoDataURL}" alt="Logo" style="max-height:80px;max-width:180px;object-fit:contain;" />`
      : '';

    const itemRows = d.items.map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${escHtml(item.desc)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.price, cur)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.tax}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.amount, cur)}</td>
      </tr>`).join('');

    container.innerHTML = `
      <div id="invoice-document" style="
        background:#fff;color:#1a1a1a;font-family:'Segoe UI',Arial,sans-serif;
        max-width:780px;margin:0 auto;padding:48px 48px 56px;
        box-shadow:0 4px 32px rgba(0,0,0,.10);border-radius:8px;min-height:900px;">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;">
          <div>
            ${logoHTML}
            <div style="font-size:22px;font-weight:700;margin-top:${logoDataURL ? '12px' : '0'}">${escHtml(d.bizName)}</div>
            <div style="color:#666;font-size:13px;margin-top:4px;white-space:pre-line;">${escHtml(d.bizAddress)}</div>
            ${d.bizEmail ? `<div style="color:#666;font-size:13px;">${escHtml(d.bizEmail)}</div>` : ''}
            ${d.bizPhone ? `<div style="color:#666;font-size:13px;">${escHtml(d.bizPhone)}</div>` : ''}
            ${d.bizTaxId ? `<div style="color:#666;font-size:12px;margin-top:2px;">Tax ID: ${escHtml(d.bizTaxId)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:32px;font-weight:800;letter-spacing:-1px;color:#1a1a1a;">INVOICE</div>
            <div style="font-size:15px;font-weight:600;color:#555;margin-top:6px;">${escHtml(d.invoiceNum)}</div>
            ${d.issueDate ? `<div style="font-size:13px;color:#888;margin-top:4px;">Issued: ${escHtml(d.issueDate)}</div>` : ''}
            ${d.dueDate   ? `<div style="font-size:13px;color:#e05c2a;font-weight:600;margin-top:2px;">Due: ${escHtml(d.dueDate)}</div>` : ''}
          </div>
        </div>

        <!-- Bill To -->
        <div style="background:#f8f9fa;border-radius:6px;padding:20px 24px;margin-bottom:36px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:8px;">Bill To</div>
          <div style="font-size:16px;font-weight:700;">${escHtml(d.clientName)}</div>
          ${d.clientAddress ? `<div style="color:#666;font-size:13px;margin-top:2px;white-space:pre-line;">${escHtml(d.clientAddress)}</div>` : ''}
          ${d.clientEmail   ? `<div style="color:#666;font-size:13px;">${escHtml(d.clientEmail)}</div>` : ''}
          ${d.clientPhone   ? `<div style="color:#666;font-size:13px;">${escHtml(d.clientPhone)}</div>` : ''}
        </div>

        <!-- Items table -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="background:#1a1a1a;color:#fff;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;">Description</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;">Unit Price</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;">Tax %</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#aaa;">No items added</td></tr>'}</tbody>
        </table>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:36px;">
          <div style="min-width:260px;">
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid #eee;">
              <span style="color:#666;">Subtotal</span>
              <span>${fmt(d.subtotal, cur)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid #eee;">
              <span style="color:#666;">Tax</span>
              <span>${fmt(d.taxTotal, cur)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:18px;font-weight:800;">
              <span>Total Due</span>
              <span style="color:#1a1a1a;">${fmt(d.total, cur)}</span>
            </div>
          </div>
        </div>

        <!-- Notes / bank info -->
        ${d.notes || d.bankInfo ? `
        <div style="border-top:1px solid #eee;padding-top:24px;">
          ${d.notes    ? `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px;">Notes</div><div style="font-size:13px;color:#555;white-space:pre-line;">${escHtml(d.notes)}</div></div>` : ''}
          ${d.bankInfo ? `<div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px;">Payment Details</div><div style="font-size:13px;color:#555;white-space:pre-line;">${escHtml(d.bankInfo)}</div></div>` : ''}
        </div>` : ''}

        <div style="margin-top:40px;text-align:center;font-size:11px;color:#ccc;">
          Generated with InvoiceFlow · invoiceflow.app
        </div>
      </div>`;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Logo upload ─────────────────────────────────────────── */
  function initLogoUpload() {
    const input  = $('input[type="file"][accept*="image"], #logo-upload, [data-field="logo"]');
    const imgEl  = $('#logo-preview, .logo-img, img[alt="Logo"]');
    const removeBtn = $('#remove-logo, .btn-remove-logo, [data-action="removeLogo"]');
    const dropZone  = $('.logo-drop, .logo-upload-area, [data-drop="logo"]');

    if (!input && !dropZone) return;

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2 MB'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        logoDataURL = e.target.result;
        if (imgEl) { imgEl.src = logoDataURL; imgEl.style.display = ''; }
        if (dropZone) dropZone.classList.add('has-logo');
        updatePreview();
      };
      reader.readAsDataURL(file);
    }

    if (input) {
      input.addEventListener('change', () => handleFile(input.files[0]));
    }
    if (dropZone) {
      dropZone.addEventListener('click', () => input && input.click());
      dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFile(e.dataTransfer.files[0]);
      });
    }
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        logoDataURL = null;
        if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
        if (input) input.value = '';
        if (dropZone) dropZone.classList.remove('has-logo');
        updatePreview();
      });
    }
  }

  /* ── Download PDF ────────────────────────────────────────── */
  function downloadPDF() {
    updatePreview(); // ensure preview is fresh

    // Strategy 1: use html2canvas + jsPDF if available
    if (typeof html2canvas !== 'undefined' && typeof window.jspdf !== 'undefined') {
      const doc = $('#invoice-document');
      if (!doc) return;
      html2canvas(doc, { scale: 2, useCORS: true, backgroundColor: '#fff' }).then(canvas => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgW = 210;
        const imgH = (canvas.height * imgW) / canvas.width;
        let posY = 0;
        const pageH = 297;
        while (posY < imgH) {
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, -posY, imgW, imgH);
          posY += pageH;
          if (posY < imgH) pdf.addPage();
        }
        const d      = getFormData();
        const fname  = `Invoice-${d.invoiceNum || 'draft'}.pdf`;
        pdf.save(fname);
      });
      return;
    }

    // Strategy 2: load jsPDF + html2canvas dynamically
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => {
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => {
        downloadPDF(); // retry after load
      });
    });
  }

  function loadScript(src, cb) {
    if (document.querySelector(`script[src="${src}"
    
