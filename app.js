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
