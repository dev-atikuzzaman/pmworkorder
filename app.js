// ============================================================
// GasField WorkOrder LogBook — Main App
// ============================================================

const DB_KEY = 'gasfield_workorders';
const THEME_KEY = 'gasfield_theme';

// ============================================================
// STATE
// ============================================================
let orders = [];
let sortOrder = 'desc';
let searchQuery = '';
let categoryFilter = '';
let editingId = null;
let deleteTargetId = null;
let currentImageBase64 = null;
let deferredInstallPrompt = null;
let viewingId = null;

const CATEGORY_COLORS = ['cat-0','cat-1','cat-2','cat-3','cat-4','cat-5','cat-6','cat-7'];
const categoryColorMap = {};

// ============================================================
// UTILS
// ============================================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function saveOrders() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(orders));
  } catch (e) {
    showToast('স্টোরেজ পূর্ণ। পুরনো এন্ট্রি মুছুন।', 'error');
  }
}

function loadOrders() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    orders = raw ? JSON.parse(raw) : [];
  } catch { orders = []; }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগ','সেপ্ট','অক্টো','নভে','ডিসে'];
  return `${d} ${months[parseInt(m)-1]}, ${y}`;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function getCategoryColor(cat) {
  if (!cat) return 'cat-0';
  if (!categoryColorMap[cat]) {
    const used = Object.values(categoryColorMap);
    const avail = CATEGORY_COLORS.filter(c => !used.includes(c));
    categoryColorMap[cat] = avail.length ? avail[0] : CATEGORY_COLORS[Object.keys(categoryColorMap).length % CATEGORY_COLORS.length];
  }
  return categoryColorMap[cat];
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlightText(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>');
}

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const curMonth = getCurrentMonth();
  const thisMonth = orders.filter(o => o.date && o.date.startsWith(curMonth)).length;
  const cats = new Set(orders.map(o => o.category).filter(Boolean));

  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statThisMonth').textContent = thisMonth;
  document.getElementById('statCategories').textContent = cats.size;
}

// ============================================================
// CATEGORY FILTER DROPDOWN
// ============================================================
function updateCategoryDropdown() {
  const cats = [...new Set(orders.map(o => o.category).filter(Boolean))].sort();
  const sel = document.getElementById('categoryFilter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">সব ক্যাটাগরি</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}" ${c === cur ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

  // Also update datalist
  const dl = document.getElementById('categoryList');
  dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

// ============================================================
// RENDER ORDERS
// ============================================================
function getFilteredOrders() {
  let list = [...orders];

  if (categoryFilter) {
    list = list.filter(o => o.category === categoryFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(o =>
      (o.problem || '').toLowerCase().includes(q) ||
      (o.solution || '').toLowerCase().includes(q) ||
      (o.category || '').toLowerCase().includes(q) ||
      (o.notes || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    if (sortOrder === 'desc') return (b.date || '').localeCompare(a.date || '');
    return (a.date || '').localeCompare(b.date || '');
  });

  return list;
}

function renderOrders() {
  const grid = document.getElementById('ordersGrid');
  const emptyState = document.getElementById('emptyState');
  const list = getFilteredOrders();

  // Remove old cards (keep emptyState)
  [...grid.querySelectorAll('.order-card, .no-results')].forEach(el => el.remove());

  if (orders.length === 0) {
    emptyState.style.display = '';
    updateActiveFilters();
    return;
  }

  emptyState.style.display = 'none';

  if (list.length === 0) {
    grid.insertAdjacentHTML('beforeend', `
      <div class="no-results">
        <h3>কোনো ফলাফল পাওয়া যায়নি</h3>
        <p>ভিন্ন সার্চ টার্ম বা ফিল্টার ব্যবহার করুন</p>
      </div>
    `);
    updateActiveFilters();
    return;
  }

  const q = searchQuery;
  list.forEach(order => {
    const colorClass = getCategoryColor(order.category);
    const card = document.createElement('div');
    card.className = 'order-card';
    card.dataset.id = order.id;
    card.innerHTML = `
      <div class="card-header">
        <div class="card-meta">
          <span class="category-badge ${colorClass}">${escapeHtml(order.category || 'সাধারণ')}</span>
          <span class="card-date">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            ${formatDate(order.date)}
          </span>
        </div>
        <div class="card-actions">
          <button class="btn-icon-sm edit-btn" data-action="edit" data-id="${order.id}" title="সম্পাদনা করুন">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon-sm delete-btn" data-action="delete" data-id="${order.id}" title="মুছুন">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="card-problem">${highlightText(order.problem || '', q)}</div>
      <div class="card-solution-wrap">
        <div class="card-solution-label">✓ সমাধান</div>
        <div class="card-solution">${highlightText(order.solution || '', q)}</div>
      </div>
      ${order.image || order.notes ? `
      <div class="card-footer">
        ${order.image ? `<span class="has-image-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg> ছবি সংযুক্ত</span>` : '<span></span>'}
        ${order.notes ? `<span style="font-size:0.72rem;color:var(--text-muted)">মন্তব্য আছে</span>` : ''}
      </div>` : ''}
    `;

    card.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        e.stopPropagation();
        const id = action.dataset.id;
        if (action.dataset.action === 'edit') openEditModal(id);
        if (action.dataset.action === 'delete') openDeleteConfirm(id);
      } else {
        openViewModal(order.id);
      }
    });

    grid.appendChild(card);
  });

  updateActiveFilters();
}

// ============================================================
// ACTIVE FILTERS DISPLAY
// ============================================================
function updateActiveFilters() {
  const wrap = document.getElementById('activeFilters');
  const tags = [];

  if (searchQuery) {
    tags.push(`<div class="filter-tag">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      "${escapeHtml(searchQuery)}"
      <button onclick="clearSearch()" title="সার্চ মুছুন"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>`);
  }

  if (categoryFilter) {
    const colorClass = getCategoryColor(categoryFilter);
    tags.push(`<div class="filter-tag">
      <span class="category-badge ${colorClass}" style="padding:1px 6px;font-size:0.65rem;">${escapeHtml(categoryFilter)}</span>
      <button onclick="clearCategoryFilter()" title="ফিল্টার মুছুন"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>`);
  }

  if (tags.length) {
    wrap.style.display = 'flex';
    wrap.innerHTML = tags.join('');
  } else {
    wrap.style.display = 'none';
  }
}

window.clearSearch = function() {
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').style.display = 'none';
  renderOrders();
};

window.clearCategoryFilter = function() {
  categoryFilter = '';
  document.getElementById('categoryFilter').value = '';
  renderOrders();
};

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  document.getElementById('modalBackdrop').classList.add('active');
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Only remove backdrop if no other modal is open
  const anyOpen = document.querySelectorAll('.modal.open').length > 0;
  if (!anyOpen) {
    document.getElementById('modalBackdrop').classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
  document.getElementById('modalBackdrop').classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================================
// ADD/EDIT MODAL
// ============================================================
function openAddModal() {
  editingId = null;
  currentImageBase64 = null;
  document.getElementById('modalTitle').textContent = 'নতুন ওয়ার্ক অর্ডার';
  document.getElementById('btnSave').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> সেভ করুন`;
  resetForm();
  // Set today's date
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fieldDate').value = today;
  openModal('orderModal');
  setTimeout(() => document.getElementById('fieldDate').focus(), 100);
}

function openEditModal(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  editingId = id;
  currentImageBase64 = order.image || null;

  document.getElementById('modalTitle').textContent = 'এন্ট্রি সম্পাদনা';
  document.getElementById('btnSave').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg> আপডেট করুন`;
  resetForm();

  document.getElementById('editId').value = id;
  document.getElementById('fieldDate').value = order.date || '';
  document.getElementById('fieldCategory').value = order.category || '';
  document.getElementById('fieldProblem').value = order.problem || '';
  document.getElementById('fieldSolution').value = order.solution || '';
  document.getElementById('fieldNotes').value = order.notes || '';

  if (order.image) {
    showImagePreview(order.image);
  }

  closeModal('viewModal');
  openModal('orderModal');
}

function resetForm() {
  document.getElementById('orderForm').reset();
  document.getElementById('editId').value = '';
  currentImageBase64 = null;
  document.getElementById('uploadPlaceholder').style.display = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('previewImg').src = '';
  ['errDate','errCategory','errProblem','errSolution','errImage'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.remove('show');
  });
  ['fieldDate','fieldCategory','fieldProblem','fieldSolution'].forEach(id => {
    document.getElementById(id).classList.remove('error');
  });
}

// ============================================================
// VIEW MODAL
// ============================================================
function openViewModal(id) {
  const order = orders.find(o => o.id === id);
  if (!order) return;

  viewingId = id;
  const colorClass = getCategoryColor(order.category);

  document.getElementById('viewCategoryBadge').className = `view-category-badge ${colorClass}`;
  document.getElementById('viewCategoryBadge').textContent = order.category || 'সাধারণ';
  document.getElementById('viewDate').textContent = formatDate(order.date);
  document.getElementById('viewProblem').textContent = order.problem || '';
  document.getElementById('viewSolution').textContent = order.solution || '';

  const notesSection = document.getElementById('viewNotesSection');
  if (order.notes) {
    document.getElementById('viewNotes').textContent = order.notes;
    notesSection.style.display = '';
  } else {
    notesSection.style.display = 'none';
  }

  const imgSection = document.getElementById('viewImageSection');
  if (order.image) {
    document.getElementById('viewImage').src = order.image;
    imgSection.style.display = '';
  } else {
    imgSection.style.display = 'none';
  }

  openModal('viewModal');
}

document.getElementById('viewEditBtn').addEventListener('click', () => {
  if (viewingId) openEditModal(viewingId);
});

document.getElementById('viewDeleteBtn').addEventListener('click', () => {
  if (viewingId) {
    closeModal('viewModal');
    openDeleteConfirm(viewingId);
  }
});

// ============================================================
// DELETE CONFIRM
// ============================================================
function openDeleteConfirm(id) {
  deleteTargetId = id;
  openModal('deleteModal');
}

document.getElementById('deleteCancelBtn').addEventListener('click', () => {
  deleteTargetId = null;
  closeModal('deleteModal');
});

document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
  if (!deleteTargetId) return;
  orders = orders.filter(o => o.id !== deleteTargetId);
  saveOrders();
  deleteTargetId = null;
  closeAllModals();
  updateCategoryDropdown();
  updateStats();
  renderOrders();
  showToast('এন্ট্রি মুছে ফেলা হয়েছে', 'info');
});

// ============================================================
// FORM VALIDATION & SUBMIT
// ============================================================
function validateField(fieldId, errId, msg) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  const val = field.value.trim();
  if (!val) {
    field.classList.add('error');
    err.textContent = msg;
    err.classList.add('show');
    return false;
  }
  field.classList.remove('error');
  err.classList.remove('show');
  return true;
}

document.getElementById('orderForm').addEventListener('submit', (e) => {
  e.preventDefault();

  let valid = true;
  valid = validateField('fieldDate', 'errDate', 'তারিখ বাছাই করুন') && valid;
  valid = validateField('fieldCategory', 'errCategory', 'ক্যাটাগরি লিখুন') && valid;
  valid = validateField('fieldProblem', 'errProblem', 'সমস্যার বিবরণ লিখুন') && valid;
  valid = validateField('fieldSolution', 'errSolution', 'সমাধানের বিবরণ লিখুন') && valid;

  if (!valid) return;

  const date = document.getElementById('fieldDate').value;
  const category = document.getElementById('fieldCategory').value.trim();
  const problem = document.getElementById('fieldProblem').value.trim();
  const solution = document.getElementById('fieldSolution').value.trim();
  const notes = document.getElementById('fieldNotes').value.trim();

  if (editingId) {
    const idx = orders.findIndex(o => o.id === editingId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], date, category, problem, solution, notes, image: currentImageBase64, updatedAt: Date.now() };
    }
    showToast('এন্ট্রি আপডেট হয়েছে', 'success');
  } else {
    const newOrder = {
      id: genId(),
      date,
      category,
      problem,
      solution,
      notes,
      image: currentImageBase64,
      createdAt: Date.now()
    };
    orders.unshift(newOrder);
    showToast('নতুন এন্ট্রি সেভ হয়েছে', 'success');
  }

  saveOrders();
  closeModal('orderModal');
  updateCategoryDropdown();
  updateStats();
  renderOrders();
});

// ============================================================
// IMAGE UPLOAD
// ============================================================
function showImagePreview(src) {
  document.getElementById('uploadPlaceholder').style.display = 'none';
  document.getElementById('imagePreview').style.display = '';
  document.getElementById('previewImg').src = src;
}

function handleImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('শুধুমাত্র ছবি ফাইল আপলোড করুন', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('ছবির সাইজ ৫MB এর বেশি হওয়া উচিত নয়', 'error');
    return;
  }

  // Compress image
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      currentImageBase64 = canvas.toDataURL('image/jpeg', 0.82);
      showImagePreview(currentImageBase64);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById('fieldImage').addEventListener('change', (e) => {
  handleImageFile(e.target.files[0]);
});

document.getElementById('removeImg').addEventListener('click', (e) => {
  e.preventDefault();
  currentImageBase64 = null;
  document.getElementById('fieldImage').value = '';
  document.getElementById('uploadPlaceholder').style.display = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('previewImg').src = '';
});

// Drag & Drop
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  handleImageFile(e.dataTransfer.files[0]);
});

// ============================================================
// SEARCH
// ============================================================
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
let searchTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    clearSearchBtn.style.display = searchQuery ? '' : 'none';
    renderOrders();
  }, 250);
});

clearSearchBtn.addEventListener('click', () => {
  window.clearSearch();
});

// ============================================================
// SORT
// ============================================================
document.getElementById('sortDesc').addEventListener('click', () => {
  sortOrder = 'desc';
  document.getElementById('sortDesc').classList.add('active');
  document.getElementById('sortAsc').classList.remove('active');
  renderOrders();
});

document.getElementById('sortAsc').addEventListener('click', () => {
  sortOrder = 'asc';
  document.getElementById('sortAsc').classList.add('active');
  document.getElementById('sortDesc').classList.remove('active');
  renderOrders();
});

// ============================================================
// CATEGORY FILTER
// ============================================================
document.getElementById('categoryFilter').addEventListener('change', (e) => {
  categoryFilter = e.target.value;
  renderOrders();
});

// ============================================================
// MODAL OPEN/CLOSE HANDLERS
// ============================================================
document.getElementById('btnNewOrder').addEventListener('click', openAddModal);

document.getElementById('modalClose').addEventListener('click', () => closeModal('orderModal'));
document.getElementById('btnCancel').addEventListener('click', () => closeModal('orderModal'));
document.getElementById('viewModalClose').addEventListener('click', () => closeModal('viewModal'));

document.getElementById('modalBackdrop').addEventListener('click', closeAllModals);

// Keyboard: Escape closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// ============================================================
// THEME TOGGLE
// ============================================================
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

document.getElementById('btnTheme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme;
  applyTheme(cur === 'light' ? 'dark' : 'light');
});

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

// ============================================================
// PWA: SERVICE WORKER & INSTALL
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('btnInstall').style.display = '';
});

document.getElementById('btnInstall').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('btnInstall').style.display = 'none';
    showToast('অ্যাপ ইন্সটল হচ্ছে...', 'success');
  }
  deferredInstallPrompt = null;
});

window.addEventListener('appinstalled', () => {
  document.getElementById('btnInstall').style.display = 'none';
});

// ============================================================
// DATA IMPORT / EXPORT
// ============================================================
const EXPORT_COLUMNS = [
  { key: 'date',     header: 'তারিখ' },
  { key: 'category', header: 'ক্যাটাগরি' },
  { key: 'problem',  header: 'সমস্যার বিবরণ' },
  { key: 'solution', header: 'সমাধানের বিবরণ' },
  { key: 'notes',    header: 'মন্তব্য' }
];

// Accepted header names when reading an import file (case-insensitive)
const HEADER_ALIASES = {
  date:     ['তারিখ', 'date'],
  category: ['ক্যাটাগরি', 'category'],
  problem:  ['সমস্যার বিবরণ', 'সমস্যা', 'problem', 'issue'],
  solution: ['সমাধানের বিবরণ', 'সমাধান', 'solution'],
  notes:    ['মন্তব্য', 'অতিরিক্ত মন্তব্য', 'notes', 'note']
};

let importParsedRows = null; // { headerMap, dataRows } staged for import

function xlsxReady() {
  if (typeof XLSX === 'undefined') {
    showToast('এই ফিচারের জন্য একবার ইন্টারনেট সংযোগ প্রয়োজন', 'error');
    return false;
  }
  return true;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ordersToAOA() {
  const rows = [EXPORT_COLUMNS.map(c => c.header)];
  [...orders]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .forEach(o => rows.push(EXPORT_COLUMNS.map(c => o[c.key] || '')));
  return rows;
}

function exportCSV() {
  if (!xlsxReady()) return;
  if (!orders.length) { showToast('এক্সপোর্ট করার জন্য কোনো এন্ট্রি নেই', 'error'); return; }
  const ws = XLSX.utils.aoa_to_sheet(ordersToAOA());
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `worklog-export-${todayStr()}.csv`);
  showToast('CSV ফাইল ডাউনলোড হয়েছে', 'success');
}

function exportXLSX() {
  if (!xlsxReady()) return;
  if (!orders.length) { showToast('এক্সপোর্ট করার জন্য কোনো এন্ট্রি নেই', 'error'); return; }
  const ws = XLSX.utils.aoa_to_sheet(ordersToAOA());
  ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 42 }, { wch: 42 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'WorkOrders');
  XLSX.writeFile(wb, `worklog-export-${todayStr()}.xlsx`);
  showToast('Excel ফাইল ডাউনলোড হয়েছে', 'success');
}

function downloadTemplate() {
  if (!xlsxReady()) return;
  const rows = [
    EXPORT_COLUMNS.map(c => c.header),
    ['2026-07-02', 'মিটারিং', 'উদাহরণ: সমস্যার বিবরণ এখানে লিখুন', 'উদাহরণ: সমাধানের বিবরণ এখানে লিখুন', 'ঐচ্ছিক মন্তব্য']
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'import-template.csv');
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function mapHeaders(headerRow) {
  const map = {};
  headerRow.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    for (const key in HEADER_ALIASES) {
      if (map[key] !== undefined) continue;
      if (HEADER_ALIASES[key].some(alias => normalizeHeader(alias) === norm)) {
        map[key] = idx;
      }
    }
  });
  return map;
}

// Converts an Excel Date object or a plain string into 'YYYY-MM-DD'
function excelDateToStr(val) {
  if (val instanceof Date && !isNaN(val)) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    // Assumes DD/MM/YYYY or DD-MM-YYYY
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed)) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return s;
}

function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = isCsv
          ? XLSX.read(e.target.result, { type: 'string' })
          : XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        resolve(aoa);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া যায়নি'));
    if (isCsv) reader.readAsText(file, 'UTF-8');
    else reader.readAsArrayBuffer(file);
  });
}

async function handleImportFileSelected(file) {
  if (!file || !xlsxReady()) return;
  try {
    const aoa = await parseImportFile(file);
    if (!aoa.length) { showToast('ফাইলে কোনো ডাটা পাওয়া যায়নি', 'error'); return; }

    const headerMap = mapHeaders(aoa[0]);
    if (['date', 'category', 'problem', 'solution'].some(k => headerMap[k] === undefined)) {
      showToast('কলাম হেডার মেলেনি। তারিখ, ক্যাটাগরি, সমস্যার বিবরণ ও সমাধানের বিবরণ কলাম আবশ্যক', 'error');
      return;
    }

    importParsedRows = { headerMap, dataRows: aoa.slice(1) };
    const nameEl = document.getElementById('importFileName');
    nameEl.textContent = `নির্বাচিত ফাইল: ${file.name} — ${aoa.length - 1} টি সারি পাওয়া গেছে`;
    nameEl.style.display = '';
    document.getElementById('btnDoImport').disabled = false;
  } catch (err) {
    showToast('ফাইল পার্স করা যায়নি। ফরম্যাট চেক করে আবার চেষ্টা করুন', 'error');
  }
}

function runImport() {
  if (!importParsedRows) return;
  const { headerMap, dataRows } = importParsedRows;
  let added = 0, skippedDup = 0, skippedInvalid = 0;

  dataRows.forEach(row => {
    if (!row || row.every(c => c === '' || c === undefined || c === null)) return;

    const date = excelDateToStr(row[headerMap.date]);
    const category = String(row[headerMap.category] ?? '').trim();
    const problem = String(row[headerMap.problem] ?? '').trim();
    const solution = String(row[headerMap.solution] ?? '').trim();
    const notes = headerMap.notes !== undefined ? String(row[headerMap.notes] ?? '').trim() : '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !category || !problem || !solution) {
      skippedInvalid++;
      return;
    }

    const isDup = orders.some(o =>
      o.date === date && o.category === category && o.problem === problem && o.solution === solution
    );
    if (isDup) { skippedDup++; return; }

    orders.push({
      id: genId(), date, category, problem, solution, notes,
      image: null, createdAt: Date.now()
    });
    added++;
  });

  saveOrders();
  updateCategoryDropdown();
  updateStats();
  renderOrders();

  let msg = `${added} টি এন্ট্রি ইম্পোর্ট হয়েছে`;
  if (skippedDup) msg += `, ${skippedDup} টি ডুপ্লিকেট বাদ দেওয়া হয়েছে`;
  if (skippedInvalid) msg += `, ${skippedInvalid} টি অসম্পূর্ণ সারি বাদ দেওয়া হয়েছে`;
  showToast(msg, added > 0 ? 'success' : 'info');

  resetImportUI();
  closeModal('dataModal');
}

function resetImportUI() {
  importParsedRows = null;
  document.getElementById('fieldImportFile').value = '';
  document.getElementById('importFileName').style.display = 'none';
  document.getElementById('importFileName').textContent = '';
  document.getElementById('btnDoImport').disabled = true;
}

document.getElementById('btnDataIO').addEventListener('click', () => {
  resetImportUI();
  openModal('dataModal');
});
document.getElementById('dataModalClose').addEventListener('click', () => closeModal('dataModal'));
document.getElementById('btnExportCsv').addEventListener('click', exportCSV);
document.getElementById('btnExportXlsx').addEventListener('click', exportXLSX);
document.getElementById('btnDownloadTemplate').addEventListener('click', downloadTemplate);
document.getElementById('fieldImportFile').addEventListener('change', (e) => handleImportFileSelected(e.target.files[0]));
document.getElementById('btnDoImport').addEventListener('click', runImport);

const importZone = document.getElementById('importZone');
importZone.addEventListener('dragover', (e) => { e.preventDefault(); importZone.classList.add('dragover'); });
importZone.addEventListener('dragleave', () => importZone.classList.remove('dragover'));
importZone.addEventListener('drop', (e) => {
  e.preventDefault();
  importZone.classList.remove('dragover');
  handleImportFileSelected(e.dataTransfer.files[0]);
});

// ============================================================
// ANALYTICS / PERFORMANCE TAB
// ============================================================
const CHART_COLORS = ['#f59e0b','#3b82f6','#22c55e','#ef4444','#a855f7','#06b6d4','#ec4899','#84cc16','#f97316','#eab308'];
const WEEK_NAME = 'সপ্তাহ';
const MONTH_SHORT = ['জানু','ফেব্রু','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগ','সেপ্ট','অক্টো','নভে','ডিসে'];

let currentAnalyticsMonth = getCurrentMonth();
let comparePeriodType = 'month';
let selectedComparePeriods = new Set();

// ---- Tab switching ----
function switchView(view) {
  document.getElementById('tabEntries').classList.toggle('active', view === 'entries');
  document.getElementById('tabAnalytics').classList.toggle('active', view === 'analytics');
  document.getElementById('entriesView').style.display = view === 'entries' ? '' : 'none';
  document.getElementById('analyticsView').style.display = view === 'analytics' ? '' : 'none';
  if (view === 'analytics') renderAnalytics();
}
document.getElementById('tabEntries').addEventListener('click', () => switchView('entries'));
document.getElementById('tabAnalytics').addEventListener('click', () => switchView('analytics'));

// ---- Period key helpers ----
function getMonthKey(dateStr) { return (dateStr || '').slice(0, 7); }
function getYearKey(dateStr) { return (dateStr || '').slice(0, 4); }

function getISOWeekKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getPeriodKey(dateStr, type) {
  if (type === 'week') return getISOWeekKey(dateStr);
  if (type === 'year') return getYearKey(dateStr);
  return getMonthKey(dateStr);
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-');
  const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  return `${months[parseInt(m, 10) - 1] || ''} ${y}`;
}

// { main, sub } short label pair used both for chart bars and checklist text
function periodLabelParts(key, type) {
  if (type === 'month') {
    const [y, m] = key.split('-');
    return { main: MONTH_SHORT[parseInt(m, 10) - 1] || key, sub: y };
  }
  if (type === 'year') {
    return { main: key, sub: '' };
  }
  if (type === 'week') {
    const [y, w] = key.split('-W');
    return { main: `${WEEK_NAME} ${parseInt(w, 10)}`, sub: y };
  }
  return { main: key, sub: '' };
}

function periodLabel(key, type) {
  const { main, sub } = periodLabelParts(key, type);
  return sub ? `${main}, ${sub}` : main;
}

// ---- Master render ----
function renderAnalytics() {
  renderMonthSummary();
  renderCategoryBreakdown();
  renderCompareControls();
  renderCompareChart();
}

// ---- Monthly breakdown: month picker ----
document.getElementById('monthSelect').addEventListener('change', (e) => {
  if (e.target.value) {
    currentAnalyticsMonth = e.target.value;
    renderMonthSummary();
    renderCategoryBreakdown();
  }
});
document.getElementById('monthPrev').addEventListener('click', () => {
  currentAnalyticsMonth = shiftMonth(currentAnalyticsMonth, -1);
  renderMonthSummary();
  renderCategoryBreakdown();
});
document.getElementById('monthNext').addEventListener('click', () => {
  currentAnalyticsMonth = shiftMonth(currentAnalyticsMonth, 1);
  renderMonthSummary();
  renderCategoryBreakdown();
});

function renderMonthSummary() {
  document.getElementById('monthSelect').value = currentAnalyticsMonth;

  const thisEntries = orders.filter(o => getMonthKey(o.date) === currentAnalyticsMonth);
  const prevMonth = shiftMonth(currentAnalyticsMonth, -1);
  const prevEntries = orders.filter(o => getMonthKey(o.date) === prevMonth);
  const cats = new Set(thisEntries.map(o => o.category || 'সাধারণ'));

  let changeText, changeClass;
  if (thisEntries.length === 0 && prevEntries.length === 0) {
    changeText = '—'; changeClass = 'neutral';
  } else if (prevEntries.length === 0) {
    changeText = 'নতুন'; changeClass = 'up';
  } else {
    const pct = Math.round(((thisEntries.length - prevEntries.length) / prevEntries.length) * 100);
    changeText = `${pct > 0 ? '+' : ''}${pct}%`;
    changeClass = pct > 0 ? 'up' : (pct < 0 ? 'down' : 'neutral');
  }

  document.getElementById('monthSummary').innerHTML = `
    <div class="month-stat-card">
      <span class="month-stat-num">${thisEntries.length}</span>
      <span class="month-stat-label">মোট এন্ট্রি</span>
    </div>
    <div class="month-stat-card">
      <span class="month-stat-num">${cats.size}</span>
      <span class="month-stat-label">সক্রিয় ক্যাটাগরি</span>
    </div>
    <div class="month-stat-card">
      <span class="month-stat-num change-${changeClass}">${changeText}</span>
      <span class="month-stat-label">গত মাসের তুলনায়</span>
    </div>
  `;
}

function renderCategoryBreakdown() {
  const grid = document.getElementById('categoryBreakdownGrid');
  const monthEntries = orders.filter(o => getMonthKey(o.date) === currentAnalyticsMonth);

  if (!monthEntries.length) {
    grid.innerHTML = `<div class="analytics-empty">${monthLabel(currentAnalyticsMonth)} মাসে কোনো এন্ট্রি নেই</div>`;
    return;
  }

  const counts = {};
  monthEntries.forEach(o => {
    const c = o.category || 'সাধারণ';
    counts[c] = (counts[c] || 0) + 1;
  });

  const maxCount = Math.max(...Object.values(counts));
  const sortedCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  grid.innerHTML = sortedCats.map(cat => {
    const colorClass = getCategoryColor(cat);
    const count = counts[cat];
    const pct = Math.round((count / maxCount) * 100);
    return `
      <div class="cat-rect ${colorClass}" data-category="${escapeHtml(cat)}">
        <div class="cat-rect-top">
          <span class="cat-rect-name">${escapeHtml(cat)}</span>
          <span class="cat-rect-count">${count}</span>
        </div>
        <div class="cat-rect-bar-track">
          <div class="cat-rect-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.cat-rect').forEach(el => {
    el.addEventListener('click', () => openCategoryEntries(el.dataset.category));
  });
}

// ---- Drill-down modal ----
function openCategoryEntries(category) {
  const list = orders
    .filter(o => getMonthKey(o.date) === currentAnalyticsMonth && (o.category || 'সাধারণ') === category)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  document.getElementById('categoryEntriesTitle').textContent = `${category} — ${monthLabel(currentAnalyticsMonth)} (${list.length})`;
  document.getElementById('categoryEntriesList').innerHTML = list.map(o => `
    <div class="cat-entry-row" data-id="${o.id}">
      <span class="cat-entry-date">${formatDate(o.date)}</span>
      <span class="cat-entry-problem">${escapeHtml(o.problem || '')}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>
  `).join('');

  document.getElementById('categoryEntriesList').querySelectorAll('.cat-entry-row').forEach(row => {
    row.addEventListener('click', () => {
      closeModal('categoryEntriesModal');
      openViewModal(row.dataset.id);
    });
  });

  openModal('categoryEntriesModal');
}
document.getElementById('categoryEntriesClose').addEventListener('click', () => closeModal('categoryEntriesModal'));

// ---- Comparison chart controls ----
function getAllPeriodKeys(type) {
  const keys = new Set();
  orders.forEach(o => { if (o.date) keys.add(getPeriodKey(o.date, type)); });
  return [...keys].sort().reverse(); // most recent first
}

document.getElementById('comparePeriodType').addEventListener('change', (e) => {
  comparePeriodType = e.target.value;
  selectedComparePeriods.clear();
  renderCompareControls();
  renderCompareChart();
});
document.getElementById('compareCategory').addEventListener('change', renderCompareChart);

document.getElementById('btnApplyLastN').addEventListener('click', () => {
  const n = parseInt(document.getElementById('compareLastN').value, 10);
  if (!n || n < 1) { showToast('একটি সঠিক সংখ্যা দিন', 'error'); return; }
  const allKeys = getAllPeriodKeys(comparePeriodType);
  selectedComparePeriods = new Set(allKeys.slice(0, n));
  renderCompareControls();
  renderCompareChart();
});

function renderCompareControls() {
  // Category dropdown
  const catSel = document.getElementById('compareCategory');
  const curCat = catSel.value;
  const cats = [...new Set(orders.map(o => o.category).filter(Boolean))].sort();
  catSel.innerHTML = '<option value="">সব ক্যাটাগরি (মোট)</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}" ${c === curCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

  // Period checklist
  const allKeys = getAllPeriodKeys(comparePeriodType);
  const wrap = document.getElementById('comparePeriodsSelect');

  if (!allKeys.length) {
    wrap.innerHTML = `<span class="analytics-empty-inline">তুলনার জন্য কোনো ডাটা নেই</span>`;
    return;
  }

  if (selectedComparePeriods.size === 0) {
    allKeys.slice(0, 6).forEach(k => selectedComparePeriods.add(k));
  }

  wrap.innerHTML = allKeys.map(k => {
    const checked = selectedComparePeriods.has(k);
    return `
      <label class="period-check${checked ? ' checked' : ''}">
        <input type="checkbox" value="${k}" ${checked ? 'checked' : ''} />
        <span>${periodLabel(k, comparePeriodType)}</span>
      </label>
    `;
  }).join('');

  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedComparePeriods.add(cb.value);
      else selectedComparePeriods.delete(cb.value);
      cb.closest('.period-check').classList.toggle('checked', cb.checked);
      renderCompareChart();
    });
  });
}

function renderCompareChart() {
  const type = comparePeriodType;
  const category = document.getElementById('compareCategory').value;
  const chartWrap = document.getElementById('chartWrap');

  const keys = [...selectedComparePeriods].sort();
  if (!keys.length) {
    chartWrap.innerHTML = `<div class="analytics-empty">তুলনা করার জন্য অন্তত একটি সময়কাল বাছাই করুন</div>`;
    return;
  }

  const data = keys.map((k, i) => {
    const count = orders.filter(o =>
      o.date && getPeriodKey(o.date, type) === k && (!category || o.category === category)
    ).length;
    const parts = periodLabelParts(k, type);
    return { key: k, main: parts.main, sub: parts.sub, value: count, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  chartWrap.innerHTML = buildBarChartSVG(data);
}

function buildBarChartSVG(data) {
  const maxVal = Math.max(1, ...data.map(d => d.value));
  const barW = 48, gap = 22, chartH = 200, topPad = 24, bottomLabelH = 40;
  const w = data.length * (barW + gap) + gap;
  const h = topPad + chartH + bottomLabelH;

  const bars = data.map((d, i) => {
    const x = gap + i * (barW + gap);
    const barH = Math.round((d.value / maxVal) * (chartH - 16));
    const y = topPad + (chartH - barH);
    return `
      <g>
        <title>${escapeHtml(d.main)}${d.sub ? ', ' + escapeHtml(d.sub) : ''}: ${d.value}</title>
        <text x="${x + barW / 2}" y="${Math.max(topPad + 10, y - 8)}" text-anchor="middle" class="chart-bar-value">${d.value}</text>
        <rect class="chart-bar-rect" x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 2)}" rx="6" fill="${d.color}" />
        <text x="${x + barW / 2}" y="${topPad + chartH + 18}" text-anchor="middle" class="chart-bar-label">${escapeHtml(d.main)}</text>
        <text x="${x + barW / 2}" y="${topPad + chartH + 33}" text-anchor="middle" class="chart-bar-label-sub">${escapeHtml(d.sub)}</text>
      </g>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="bar-chart-svg" preserveAspectRatio="xMinYMid meet">
    <line x1="0" y1="${topPad + chartH}" x2="${w}" y2="${topPad + chartH}" class="chart-baseline" />
    ${bars}
  </svg>`;
}

// ---- Print (per-view) ----
function printAnalyticsSection(target) {
  const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
  let titleText, sectionId, cssClass;

  if (target === 'monthly') {
    titleText = `মাসিক পারফরম্যান্স রিপোর্ট — ${monthLabel(currentAnalyticsMonth)}`;
    sectionId = 'monthlyPerfSection';
    cssClass = 'printing-analytics-monthly';
  } else {
    titleText = 'সময়ভিত্তিক তুলনা রিপোর্ট';
    sectionId = 'compareSection';
    cssClass = 'printing-analytics-compare';
  }

  const section = document.getElementById(sectionId);
  const header = document.createElement('div');
  header.className = 'print-only-header';
  header.innerHTML = `<h1>গ্যাসফিল্ড ওয়ার্ক অর্ডার লগবুক</h1><h2>${escapeHtml(titleText)}</h2><p>প্রিন্ট তারিখ: ${printDateStr}</p>`;
  section.prepend(header);

  document.body.classList.add(cssClass);
  window.print();

  const cleanup = () => {
    document.body.classList.remove(cssClass);
    header.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 3000); // fallback in case afterprint doesn't fire
}

document.getElementById('btnPrintMonthly').addEventListener('click', () => printAnalyticsSection('monthly'));
document.getElementById('btnPrintCompare').addEventListener('click', () => printAnalyticsSection('compare'));

// ============================================================
// INIT
// ============================================================
function init() {
  // Apply saved theme
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);

  loadOrders();
  updateStats();
  updateCategoryDropdown();
  renderOrders();
}

init();
