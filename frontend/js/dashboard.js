/**
 * Build My Resume — Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Guard: must be logged in
  if (await Auth.redirectIfNotLoggedIn()) return;

  // ── Init User ──
  const user = await Auth.getUser();
  if (user) {
    const profile = user.user_metadata || user;
    setUserUI({ ...user, name: profile.name || user.email.split('@')[0], avatar_url: profile.avatar_url });
    setWelcomeTitle(profile.name || user.email.split('@')[0]);
  }

  // ── Migrate Local Draft ──
  const localDraft = localStorage.getItem('local_resume_draft');
  if (localDraft) {
    try {
      const parsed = JSON.parse(localDraft);
      if (Object.keys(parsed.sections || {}).length > 0 || parsed.title) {
        await API.resumes.create({
          title: parsed.title || 'Untitled Resume',
          template_id: parsed.template_id || 'manhattan',
          sections: parsed.sections || {},
          styling: parsed.styling || {}
        });
        showToast('Your draft resume has been saved to your account!', 'success');
      }
      localStorage.removeItem('local_resume_draft');
    } catch (e) {
      console.error('Failed to migrate local draft:', e);
    }
  }

  // Load data
  await Promise.all([loadStats(), loadResumes()]);

  // ── Sidebar Collapse ──
  const sidebar = document.getElementById('sidebar');
  const appContent = document.querySelector('.app-content');

  document.getElementById('sidebarCollapseBtn').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    appContent.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  });

  // Restore sidebar state
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar.classList.add('collapsed');
    appContent.classList.add('sidebar-collapsed');
  }

  // Mobile sidebar toggle
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && sidebar.classList.contains('mobile-open') &&
        !sidebar.contains(e.target) && !document.getElementById('sidebarToggle').contains(e.target)) {
      sidebar.classList.remove('mobile-open');
    }
  });

  // ── User Dropdown ──
  const dropdownBtn = document.getElementById('userDropdownBtn');
  const userMenu = document.getElementById('userMenu');

  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = userMenu.style.display !== 'none';
    userMenu.style.display = isOpen ? 'none' : 'block';
    dropdownBtn.setAttribute('aria-expanded', !isOpen);
  });

  document.addEventListener('click', () => {
    userMenu.style.display = 'none';
    dropdownBtn.setAttribute('aria-expanded', 'false');
  });

  // ── Search ──
  let searchTimeout;
  document.getElementById('resumeSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadResumes({ search: e.target.value }), 300);
  });

  // ── Sort ──
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    loadResumes({ sort: e.target.value });
  });

  // ── Filter Tabs ──
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      loadResumes({ filter: tab.dataset.filter });
    });
  });

  // ── View Toggle ──
  document.getElementById('gridViewBtn').addEventListener('click', () => setView('grid'));
  document.getElementById('listViewBtn').addEventListener('click', () => setView('list'));

  function setView(v) {
    const grid = document.getElementById('resumesGrid');
    grid.classList.toggle('list-view', v === 'list');
    document.getElementById('gridViewBtn').classList.toggle('active', v === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', v === 'list');
    document.getElementById('gridViewBtn').setAttribute('aria-pressed', v === 'grid');
    document.getElementById('listViewBtn').setAttribute('aria-pressed', v === 'list');
  }

  // ── Create Resume Modal ──
  document.getElementById('templatePicker').addEventListener('click', (e) => {
    const card = e.target.closest('.template-pick-card');
    if (!card) return;
    document.querySelectorAll('.template-pick-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
  });

  document.getElementById('createResumeConfirm').addEventListener('click', createResume);
});

// ── Set User UI ──
function setUserUI(user) {
  const initials = getInitials(user.name);
  ['topbarAvatar', 'menuAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = initials;
      if (user.avatar_url) el.innerHTML = `<img src="${user.avatar_url}" alt="${user.name}">`;
    }
  });
  const nameEl = document.getElementById('topbarName');
  if (nameEl) nameEl.textContent = user.name.split(' ')[0];
  const menuName = document.getElementById('menuName');
  if (menuName) menuName.textContent = user.name;
  const menuEmail = document.getElementById('menuEmail');
  if (menuEmail) menuEmail.textContent = user.email;
}

function setWelcomeTitle(name) {
  const el = document.getElementById('welcomeTitle');
  if (!el) return;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (name || 'there').split(' ')[0];
  el.textContent = `${greeting}, ${first}! 👋`;
}

// ── Load Stats ──
async function loadStats() {
  try {
    const data = await API.resumes.stats();
    const s = data.stats;
    document.getElementById('statResumes').textContent = s.total_resumes || '0';
    document.getElementById('statATS').textContent = s.avg_ats_score ? `${s.avg_ats_score}%` : '—';
    document.getElementById('statDownloads').textContent = s.total_downloads || '0';
    document.getElementById('statViews').textContent = s.total_views || '0';
    document.getElementById('resumeCountBadge').textContent = s.total_resumes || '0';
  } catch (err) {
    console.warn('Stats not available:', err.message);
  }
}

// ── Load Resumes ──
let currentParams = {};
async function loadResumes(params = {}) {
  currentParams = { ...currentParams, ...params };
  const grid = document.getElementById('resumesGrid');
  grid.innerHTML = '';

  // Show skeletons
  for (let i = 0; i < 3; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    grid.appendChild(sk);
  }

  try {
    const queryParams = {};
    if (currentParams.search) queryParams.search = currentParams.search;
    if (currentParams.sort) queryParams.sort = currentParams.sort;
    if (currentParams.filter) queryParams.filter = currentParams.filter;

    const data = await API.resumes.list(queryParams);
    const resumes = data.resumes || [];

    grid.innerHTML = '';

    if (resumes.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📄</div>
          <h3>No resumes yet</h3>
          <p>Create your first resume and start applying for jobs with a professional edge.</p>
          <button class="btn btn-primary" onclick="openCreateModal()">Create Your First Resume →</button>
        </div>`;
      return;
    }

    resumes.forEach((resume, i) => {
      grid.appendChild(createResumeCard(resume, i));
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">⚠️</div>
      <h3>Could not load resumes</h3>
      <p>${err.message}</p>
      <button class="btn btn-secondary" onclick="loadResumes()">Try Again</button>
    </div>`;
  }
}

// ── Create Resume Card ──
function createResumeCard(resume, index) {
  const card = document.createElement('div');
  card.className = 'resume-card';
  card.style.animationDelay = `${index * 0.06}s`;
  card.setAttribute('role', 'listitem');

  const ats = resume.ats_score || 0;
  const atsPct = `${(ats / 100 * 360).toFixed(0)}deg`;
  const atsColor = ats >= 80 ? 'var(--success)' : ats >= 60 ? 'var(--warning)' : 'var(--danger)';

  const templateColors = {
    manhattan: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    silicon: '#f1f5f9',
    artisan: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    horizon: 'linear-gradient(135deg, #10b981, #3b82f6)',
    executive: '#1a1a2e'
  };
  const thumbBg = templateColors[resume.template_id] || templateColors.manhattan;

  card.innerHTML = `
    <div class="resume-card-thumb">
      <div class="resume-thumb-preview" style="background:${thumbBg}">
        <div style="height:8px;background:rgba(255,255,255,0.3);border-radius:3px;width:70%"></div>
        <div style="height:5px;background:rgba(255,255,255,0.2);border-radius:3px;width:50%"></div>
        <div style="height:5px;background:rgba(255,255,255,0.15);border-radius:3px;width:85%;margin-top:8px"></div>
        <div style="height:5px;background:rgba(255,255,255,0.15);border-radius:3px;width:75%"></div>
        <div style="height:5px;background:rgba(255,255,255,0.15);border-radius:3px;width:65%"></div>
      </div>
      <div class="thumb-template-badge">${resume.template_name || resume.template_id}</div>
    </div>
    <div class="resume-card-body">
      <div class="resume-card-header">
        <div class="resume-card-title" title="${resume.title}">${resume.title}</div>
        <div class="resume-card-actions">
          <button class="btn btn-ghost btn-icon btn-sm resume-menu-btn" 
            data-id="${resume.id}" data-title="${resume.title}"
            aria-label="Actions for ${resume.title}" aria-haspopup="true">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </div>
      <div class="resume-card-date">
        <span>Edited ${formatDate(resume.updated_at)}</span>
        ${resume.is_public ? '<span class="badge badge-success" style="font-size:10px">Shared</span>' : ''}
      </div>
    </div>
    <div class="resume-card-footer">
      <div class="ats-mini">
        <div class="ats-mini-score" style="--ats-pct: ${atsPct}; background: conic-gradient(${atsColor} ${atsPct}, var(--surface-3) 0)">
          <span>${ats || '?'}</span>
        </div>
        <span>ATS Score</span>
      </div>
      <a href="builder.html?id=${resume.id}" class="btn btn-secondary btn-sm">Edit →</a>
    </div>
  `;

  // Navigate to builder on card click (not on action buttons)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.resume-card-actions') && !e.target.closest('.btn')) {
      window.location.href = `builder.html?id=${resume.id}`;
    }
  });

  // Action menu
  card.querySelector('.resume-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showResumeMenu(e.currentTarget, resume);
  });

  return card;
}

// ── Resume Context Menu ──
function showResumeMenu(btn, resume) {
  document.querySelectorAll('.resume-context-menu').forEach(m => m.remove());

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu resume-context-menu';
  menu.style.position = 'fixed';
  menu.style.zIndex = '9999';
  menu.innerHTML = `
    <a href="builder.html?id=${resume.id}" class="dropdown-item">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      Edit Resume
    </a>
    <button class="dropdown-item" data-action="duplicate">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      Duplicate
    </button>
    <button class="dropdown-item" data-action="download">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download PDF
    </button>
    <button class="dropdown-item" data-action="share">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      Share Link
    </button>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item danger" data-action="delete">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
      Delete
    </button>
  `;

  document.body.appendChild(menu);

  const rect = btn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  // Keep menu inside viewport
  const menuRight = window.innerWidth - rect.right;
  menu.style.right = `${Math.max(4, menuRight)}px`;

  // Check if menu extends beyond viewport bottom, reposition if needed
  const menuRect = menu.getBoundingClientRect();
  const maxHeight = window.innerHeight - 16;
  if (menuRect.bottom > window.innerHeight) {
    // Menu extends below viewport; try positioning above button instead
    menu.style.top = 'auto';
    menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
  }
  if (menuRect.height > maxHeight) {
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.overflowY = 'auto';
  }

  // Attach event listeners (more reliable than inline onclick)
  menu.querySelector('[data-action="duplicate"]').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.remove();
    duplicateResume(resume.id);
  });
  menu.querySelector('[data-action="download"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.remove();
    try {
      window.open(`builder.html?id=${resume.id}&export=true`, '_blank');
    } catch (err) {
      showToast('Could not open PDF export: ' + err.message, 'error');
    }
  });
  menu.querySelector('[data-action="share"]').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.remove();
    shareResume(resume.id);
  });
  menu.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.remove(); // close menu first
    openDeleteModal(resume.id, resume.title); // then open modal
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) menu.remove();
    }, { once: true });
  }, 0);
}

// ── Modal Functions ──
let selectedTemplateId = 'manhattan';

function openCreateModal() {
  document.getElementById('createModal').classList.remove('hidden');
  document.getElementById('newResumeTitle').focus();
}

function closeCreateModal() {
  document.getElementById('createModal').classList.add('hidden');
}

async function createResume() {
  const btn = document.getElementById('createResumeConfirm');
  const title = document.getElementById('newResumeTitle').value.trim() || 'My Resume';
  const templateCard = document.querySelector('.template-pick-card.active');
  const template_id = templateCard?.dataset.template || 'manhattan';

  setLoading(btn, true);
  try {
    const data = await API.resumes.create({ title, template_id });
    closeCreateModal();
    // Store template in sessionStorage as fallback in case query param is lost
    sessionStorage.setItem('pending_template', template_id);
    window.location.href = `builder.html?id=${data.resume.id}`;
  } catch (err) {
    showToast(err.message, 'error');
    setLoading(btn, false);
  }
}

function openDeleteModal(id, title) {
  document.querySelectorAll('.resume-context-menu').forEach(m => m.remove());
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteResumeName').textContent = title;
  document.getElementById('confirmDeleteBtn').onclick = () => deleteResume(id);
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
}

async function deleteResume(id) {
  const btn = document.getElementById('confirmDeleteBtn');
  setLoading(btn, true);
  try {
    await API.resumes.delete(id);
    closeDeleteModal();
    showToast('Resume deleted', 'success');
    await loadResumes();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
    setLoading(btn, false);
  }
}

async function duplicateResume(id) {
  document.querySelectorAll('.resume-context-menu').forEach(m => m.remove());
  try {
    await API.resumes.duplicate(id);
    showToast('Resume duplicated!', 'success');
    await loadResumes();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function shareResume(id) {
  document.querySelectorAll('.resume-context-menu').forEach(m => m.remove());
  try {
    const data = await API.resumes.share(id);
    await navigator.clipboard.writeText(data.shareUrl);
    showToast('Share link copied to clipboard! 🔗', 'success');
  } catch (err) {
    showToast('Could not generate share link', 'error');
  }
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
});

// ESC key to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.resume-context-menu').forEach(m => m.remove());
  }
});

function filterSection(filter) {
  document.querySelector(`.filter-tab[data-filter="${filter}"]`)?.click();
}
