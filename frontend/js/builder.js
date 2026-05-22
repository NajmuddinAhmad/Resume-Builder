/**
 * Build My Resume — Builder Page Main Logic
 * Handles sections, forms, drag-and-drop, styling, and AI features
 */

// ── State ──
let resumeData = null;
let currentSections = {};
let currentStyling = {};
let currentTemplate = 'manhattan';
let activeSectionKey = 'personal';

const SECTION_META = {
  personal: { label: 'Personal Info', icon: '👤', required: true },
  experience: { label: 'Experience', icon: '💼', required: false },
  education: { label: 'Education', icon: '🎓', required: false },
  skills: { label: 'Skills', icon: '⚡', required: false },
  projects: { label: 'Projects', icon: '🚀', required: false },
  certifications: { label: 'Certifications', icon: '🏆', required: false },
  languages: { label: 'Languages', icon: '🌍', required: false },
  custom: { label: 'Custom Section', icon: '📝', required: false }
};

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  // Clean up any leftover template preview inners/observers from prior runs
  if (window._templatePreviewObservers) {
    window._templatePreviewObservers.forEach(o => { try { o.disconnect(); } catch(e){} });
    window._templatePreviewObservers = [];
  }
  if (window._templatePreviewInners) {
    window._templatePreviewInners.forEach(n => { try { n.remove(); } catch(e){} });
    window._templatePreviewInners = [];
  }
  const loggedIn = await Auth.isLoggedIn();
  const params = new URLSearchParams(window.location.search);
  const resumeId = params.get('id');

  const localDraft = localStorage.getItem('local_resume_draft');

  if (resumeId) {
    if (!loggedIn) {
      window.location.href = `auth.html?returnTo=` + encodeURIComponent(`builder.html?id=${resumeId}`);
      return;
    }
  } else if (loggedIn && localDraft) {
    try {
      const parsed = JSON.parse(localDraft);
      const data = await API.resumes.create({
        title: parsed.title || 'Untitled Resume',
        template_id: parsed.template_id || 'manhattan',
        sections: parsed.sections || {},
        styling: parsed.styling || {}
      });
      localStorage.removeItem('local_resume_draft');
      window.location.replace(`builder.html?id=${data.resume.id}`);
      return;
    } catch (e) {
      console.error(e);
    }
  }

  initAutosave(resumeId);

  try {
    if (!resumeId) {
      // Guest mode OR template param
      const draft = localDraft ? JSON.parse(localDraft) : {};
      const templateParam = params.get('template') || sessionStorage.getItem('pending_template') || null;
      // Clear sessionStorage so it doesn't persist to next visit
      sessionStorage.removeItem('pending_template');
      resumeData = { title: draft.title || 'Untitled Resume', ...draft };
      currentSections = resumeData.sections || {};
      currentStyling = resumeData.styling || {};
      currentTemplate = templateParam || resumeData.template_id || 'manhattan';
      
      // Ensure default active sections are set for guest users
      if (!currentSections.activeSections) {
        currentSections.activeSections = ['personal', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'];
      }
      if (!currentSections.sectionOrder) {
        currentSections.sectionOrder = ['personal', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'];
      }
    } else {
      try {
        const data = await API.resumes.get(resumeId);
        resumeData = data.resume;
        currentSections = resumeData.sections || {};
        currentStyling = resumeData.styling || {};
        // Check sessionStorage for pending template override (e.g., set by dashboard createResume)
        const pendingTemplate = sessionStorage.getItem('pending_template');
        sessionStorage.removeItem('pending_template');
        currentTemplate = pendingTemplate || resumeData.template_id || 'manhattan';
      } catch (dbErr) {
        // DB fetch failed — fall back to guest mode
        console.warn('Could not load from DB, using guest mode:', dbErr.message);
        resumeData = { title: 'My Resume' };
        currentSections = {};
        currentStyling = {};
        currentTemplate = 'manhattan';
      }
      
      // Ensure default active sections
      if (!currentSections.activeSections) {
        currentSections.activeSections = ['personal', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'];
      }
      if (!currentSections.sectionOrder) {
        currentSections.sectionOrder = ['personal', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'];
      }
    }

    document.getElementById('resumeTitle').value = resumeData.title || 'My Resume';
    document.getElementById('currentTemplateName').textContent =
      currentTemplate.charAt(0).toUpperCase() + currentTemplate.slice(1);

    initSectionsList();
    renderActiveSectionForm();
    renderPreview(currentSections, currentStyling, currentTemplate);
    initStyleControls();
    initEventListeners(resumeId);

    setAutosaveStatus('saved');
    
    // Auto-trigger actions if returning from auth
    if (params.get('export') === 'true' && resumeId) {
      window.open(await API.resumes.exportPDF(resumeId), '_blank');
    } else if (params.get('print') === 'true') {
      setTimeout(() => document.getElementById('printBtn')?.click(), 500);
    }
  } catch (err) {
    console.error('Builder init error:', err);
    showToast('Failed to load resume: ' + err.message, 'error');
  }
});

// ── Sections List ──
function initSectionsList() {
  const list = document.getElementById('sectionsList');
  list.innerHTML = '';

  const order = currentSections.sectionOrder ||
    Object.keys(SECTION_META).filter(k => k !== 'custom');
  const active = new Set(currentSections.activeSections || order);

  order.forEach(key => {
    if (!SECTION_META[key]) return;
    const meta = SECTION_META[key];
    const isActive = active.has(key);

    const item = document.createElement('div');
    item.className = `section-item${activeSectionKey === key ? ' active' : ''}`;
    item.dataset.section = key;
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <div class="section-drag-handle" aria-label="Drag to reorder">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="6" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>
      </div>
      <span class="section-item-icon">${meta.icon}</span>
      <span class="section-item-name">${meta.label}</span>
      ${!meta.required ? `
        <button class="section-item-toggle btn btn-ghost btn-icon" style="width:22px;height:22px;border:none"
          data-section="${key}" aria-label="${isActive ? 'Hide' : 'Show'} ${meta.label}"
          title="${isActive ? 'Hide section' : 'Show section'}">
          ${isActive
            ? '<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
            : '<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
          }
        </button>
      ` : ''}
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.section-item-toggle, .section-drag-handle')) return;
      setActiveSection(key);
    });

    // Toggle section visibility
    const toggleBtn = item.querySelector('.section-item-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSection(key);
      });
    }

    list.appendChild(item);
  });

  // Drag-and-drop reorder
  if (typeof Sortable !== 'undefined') {
    Sortable.create(list, {
      handle: '.section-drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => {
        const newOrder = [...list.querySelectorAll('.section-item')].map(el => el.dataset.section);
        currentSections.sectionOrder = newOrder;
        onDataChange();
      }
    });
  }
}

function setActiveSection(key) {
  activeSectionKey = key;
  document.querySelectorAll('.section-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === key);
    if (el.dataset.section === key) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
  renderActiveSectionForm();

  // Scroll to section form
  const form = document.getElementById(`form-${key}`);
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleSection(key) {
  const active = new Set(currentSections.activeSections || []);
  if (active.has(key)) active.delete(key);
  else active.add(key);
  currentSections.activeSections = [...active];
  initSectionsList();
  renderActiveSectionForm();
  onDataChange();
}

// ── Render Form ──
function renderActiveSectionForm() {
  const container = document.getElementById('editorContent');
  container.innerHTML = '';

  const order = currentSections.sectionOrder || Object.keys(SECTION_META);
  const activeSet = new Set(currentSections.activeSections || order);

  order.forEach(key => {
    if (!activeSet.has(key) || !SECTION_META[key]) return;
    const formEl = buildSectionForm(key);
    if (formEl) container.appendChild(formEl);
  });

  // Scroll active section into view
  const active = document.getElementById(`form-${activeSectionKey}`);
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Build Section Form ──
function buildSectionForm(key) {
  const meta = SECTION_META[key];
  if (!meta) return null;

  const card = document.createElement('div');
  card.className = 'section-form-card';
  card.id = `form-${key}`;

  // All cards open by default so user can see and edit them
  // Only collapse non-active ones on small screens or if explicitly toggled
  card.innerHTML = `
    <div class="section-form-header" onclick="toggleFormCard('${key}')">
      <div class="section-form-title">
        <span>${meta.icon}</span>
        <span>${meta.label}</span>
      </div>
      <svg class="section-form-toggle" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="section-form-body" id="formBody-${key}">
      ${getFormHTML(key)}
    </div>
  `;

  // Bind events after insertion
  setTimeout(() => bindFormEvents(key), 0);

  return card;
}

function toggleFormCard(key) {
  const card = document.getElementById(`form-${key}`);
  if (card) {
    card.classList.toggle('collapsed');
    if (!card.classList.contains('collapsed')) {
      setActiveSection(key);
    }
  }
}

// ── Form HTML Generators ──
function getFormHTML(key) {
  switch(key) {
    case 'personal': return personalFormHTML();
    case 'experience': return listFormHTML('experience', 'Work Experience', ['title','company','location','startDate','endDate','current','description']);
    case 'education': return listFormHTML('education', 'Education', ['degree','school','field','startDate','endDate','gpa']);
    case 'skills': return skillsFormHTML();
    case 'projects': return listFormHTML('projects', 'Project', ['name','technologies','url','description']);
    case 'certifications': return listFormHTML('certifications', 'Certification', ['name','issuer','year','url']);
    case 'languages': return listFormHTML('languages', 'Language', ['language','proficiency']);
    case 'custom': return listFormHTML('custom', 'Custom Section', ['name','description']);
    default: return '';
  }
}

function personalFormHTML() {
  const p = currentSections.personal || {};
  return `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="p-fullName">Full Name</label>
        <input type="text" id="p-fullName" class="form-input personal-field" data-field="fullName" placeholder="John Doe" value="${esc(p.fullName||'')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="p-email">Email</label>
        <input type="email" id="p-email" class="form-input personal-field" data-field="email" placeholder="john@example.com" value="${esc(p.email||'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="p-phone">Phone</label>
        <input type="tel" id="p-phone" class="form-input personal-field" data-field="phone" placeholder="+1 (555) 000-0000" value="${esc(p.phone||'')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="p-location">Location</label>
        <input type="text" id="p-location" class="form-input personal-field" data-field="location" placeholder="City, State" value="${esc(p.location||'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="p-linkedin">LinkedIn</label>
        <input type="text" id="p-linkedin" class="form-input personal-field" data-field="linkedin" placeholder="linkedin.com/in/johndoe" value="${esc(p.linkedin||'')}">
      </div>
      <div class="form-group">
        <label class="form-label" for="p-website">Website</label>
        <input type="text" id="p-website" class="form-input personal-field" data-field="website" placeholder="johndoe.com" value="${esc(p.website||'')}">
      </div>
    </div>
    <div class="form-group" style="position:relative">
      <label class="form-label" for="p-summary">Professional Summary</label>
      <textarea id="p-summary" class="form-textarea personal-field" data-field="summary" placeholder="Write a compelling summary of your professional background and goals..." rows="4">${esc(p.summary||'')}</textarea>
      <button class="ai-rewrite-btn" onclick="aiRewriteField('summary', document.getElementById('p-summary').value)">✨ AI Rewrite</button>
    </div>
  `;
}

function skillsFormHTML() {
  const s = currentSections.skills || { technical: [], soft: [] };
  return `
    <div class="form-group">
      <label class="form-label">Technical Skills</label>
      <p class="form-hint">Press Enter or comma to add a skill</p>
      <div class="tag-input-container" id="techSkillsContainer" onclick="document.getElementById('techSkillInput').focus()">
        ${(s.technical||[]).map(skill => `<span class="tag-item">${esc(skill)}<button class="tag-remove" onclick="removeSkill('technical','${esc(skill)}')">×</button></span>`).join('')}
        <input type="text" id="techSkillInput" class="tag-input" placeholder="${(s.technical||[]).length ? '' : 'React, Python, AWS...'}" aria-label="Add technical skill">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Soft Skills</label>
      <div class="tag-input-container" id="softSkillsContainer" onclick="document.getElementById('softSkillInput').focus()">
        ${(s.soft||[]).map(skill => `<span class="tag-item">${esc(skill)}<button class="tag-remove" onclick="removeSkill('soft','${esc(skill)}')">×</button></span>`).join('')}
        <input type="text" id="softSkillInput" class="tag-input" placeholder="${(s.soft||[]).length ? '' : 'Leadership, Communication...'}" aria-label="Add soft skill">
      </div>
    </div>
  `;
}

function listFormHTML(section, itemLabel, fields) {
  const items = currentSections[section] || [];
  return `
    <div id="${section}-entries">
      ${items.map((item, i) => entryFormHTML(section, i, item, fields, itemLabel)).join('')}
    </div>
    <button class="add-entry-btn" onclick="addEntry('${section}', ${JSON.stringify(fields).replace(/"/g,"'")})">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add ${itemLabel}
    </button>
  `;
}

function entryFormHTML(section, index, item, fields, label) {
  const fieldInputs = fields.map(field => {
    const value = item[field] || '';
    if (field === 'description') {
      return `<div class="form-group" style="grid-column:1/-1;position:relative">
        <label class="form-label" for="${section}-${index}-${field}">${fieldLabel(field)}</label>
        <textarea id="${section}-${index}-${field}" class="form-textarea entry-field" data-section="${section}" data-index="${index}" data-field="${field}" rows="3">${esc(value)}</textarea>
        <button class="ai-rewrite-btn" onclick="aiRewriteField('${field}', document.getElementById('${section}-${index}-${field}').value, '${section}')">✨ AI</button>
      </div>`;
    }
    if (field === 'current') {
      return `<div class="form-group" style="display:flex;align-items:center;gap:var(--space-3);padding-top:var(--space-5)">
        <label class="switch" style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;">
          <input type="checkbox" id="${section}-${index}-current" class="entry-field" data-section="${section}" data-index="${index}" data-field="current" ${value ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute;inset:0;">
          <span class="switch-slider" style="position:absolute;inset:0;cursor:pointer;background:var(--surface-3);border-radius:9999px;transition:all var(--transition-base);"></span>
        </label>
        <label for="${section}-${index}-current" style="font-size:var(--text-sm);font-weight:500">Currently working here</label>
      </div>`;
    }
    if (field === 'proficiency') {
      return `<div class="form-group">
        <label class="form-label" for="${section}-${index}-${field}">${fieldLabel(field)}</label>
        <select id="${section}-${index}-${field}" class="form-select entry-field" data-section="${section}" data-index="${index}" data-field="${field}">
          ${['Native','Fluent','Advanced','Intermediate','Basic'].map(l => `<option ${value===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
    }
    const inputType = field.includes('Date') ? 'month' : field === 'url' ? 'url' : field === 'year' ? 'number' : 'text';
    return `<div class="form-group">
      <label class="form-label" for="${section}-${index}-${field}">${fieldLabel(field)}</label>
      <input type="${inputType}" id="${section}-${index}-${field}" class="form-input entry-field" data-section="${section}" data-index="${index}" data-field="${field}" value="${esc(value)}" placeholder="${fieldPlaceholder(field)}">
    </div>`;
  });

  return `
    <div class="entry-card" id="entry-${section}-${index}">
      <div class="entry-card-header">
        <div class="entry-card-title">${label} ${index + 1}${item.title || item.name || item.degree ? ` — ${esc(item.title||item.name||item.degree)}` : ''}</div>
        <div class="entry-card-actions">
          ${index > 0 ? `<button class="btn btn-ghost btn-icon btn-sm" onclick="moveEntry('${section}', ${index}, -1)" title="Move up">↑</button>` : ''}
          <button class="btn btn-ghost btn-icon btn-sm danger" onclick="removeEntry('${section}', ${index})" title="Remove" aria-label="Remove ${label}">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="form-row">
        ${fieldInputs.join('')}
      </div>
    </div>
  `;
}

function fieldLabel(field) {
  const labels = {
    title: 'Job Title', company: 'Company', location: 'Location',
    startDate: 'Start Date', endDate: 'End Date', current: 'Current',
    description: 'Description', degree: 'Degree', school: 'School/University',
    field: 'Field of Study', gpa: 'GPA', name: 'Name', technologies: 'Technologies',
    url: 'URL', issuer: 'Issuer', year: 'Year', language: 'Language', proficiency: 'Proficiency',
    name: 'Section Title'
  };
  return labels[field] || field.charAt(0).toUpperCase() + field.slice(1);
}

function fieldPlaceholder(field) {
  const ph = {
    title: 'Frontend Developer', company: 'Acme Corp', location: 'New York, NY',
    degree: 'Bachelor of Science', school: 'MIT', field: 'Computer Science',
    gpa: '3.8', name: 'Project Name', technologies: 'React, Node.js, PostgreSQL',
    url: 'https://...', issuer: 'AWS, Google, etc.', year: '2024',
    language: 'Spanish', proficiency: 'Fluent'
  };
  if (field === 'name') return 'Awards, Volunteering, Interests...';
  if (field === 'description') return 'Add details for this section...';
  return ph[field] || '';
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Form Bindings ──
function bindFormEvents(key) {
  // Personal fields
  document.querySelectorAll('.personal-field').forEach(input => {
    input.addEventListener('input', () => {
      if (!currentSections.personal) currentSections.personal = {};
      currentSections.personal[input.dataset.field] = input.value;
      onDataChange();
    });
  });

  // Entry fields
  document.querySelectorAll('.entry-field').forEach(input => {
    const ev = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(ev, () => {
      const { section, index, field } = input.dataset;
      if (!currentSections[section]) currentSections[section] = [];
      if (!currentSections[section][index]) currentSections[section][index] = {};
      currentSections[section][index][field] = input.type === 'checkbox' ? input.checked : input.value;
      onDataChange();
    });
  });

  // Skill tag inputs
  bindTagInput('techSkillInput', 'technical');
  bindTagInput('softSkillInput', 'soft');
}

function bindTagInput(inputId, skillType) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = input.value.trim().replace(/,/g, '');
      if (val) addSkill(skillType, val);
      input.value = '';
    }
    if (e.key === 'Backspace' && !input.value) {
      const skills = currentSections.skills?.[skillType] || [];
      if (skills.length > 0) {
        removeSkill(skillType, skills[skills.length - 1]);
      }
    }
  });
}

function addSkill(type, value) {
  if (!currentSections.skills) currentSections.skills = { technical: [], soft: [] };
  if (!currentSections.skills[type]) currentSections.skills[type] = [];
  if (!currentSections.skills[type].includes(value)) {
    currentSections.skills[type].push(value);
    refreshSkillsForm();
    onDataChange();
  }
}

function removeSkill(type, value) {
  if (!currentSections.skills?.[type]) return;
  currentSections.skills[type] = currentSections.skills[type].filter(s => s !== value);
  refreshSkillsForm();
  onDataChange();
}

function refreshSkillsForm() {
  const body = document.getElementById('formBody-skills');
  if (body) {
    body.innerHTML = skillsFormHTML();
    bindFormEvents('skills');
  }
}

// ── Entry CRUD ──
function addEntry(section, fields) {
  if (!currentSections[section]) currentSections[section] = [];
  currentSections[section].push({});
  // Re-render the section form
  const body = document.getElementById(`formBody-${section}`);
  if (body) body.innerHTML = listFormHTML(section, SECTION_META[section]?.label || section, fields);
  bindFormEvents(section);
  onDataChange();
}

function removeEntry(section, index) {
  if (!currentSections[section]) return;
  currentSections[section].splice(index, 1);
  const body = document.getElementById(`formBody-${section}`);
  const meta = SECTION_META[section];
  const fieldMap = {
    experience: ['title','company','location','startDate','endDate','current','description'],
    education: ['degree','school','field','startDate','endDate','gpa'],
    projects: ['name','technologies','url','description'],
    certifications: ['name','issuer','year','url'],
    languages: ['language','proficiency'],
    custom: ['name','description']
  };
  if (body) body.innerHTML = listFormHTML(section, meta?.label || section, fieldMap[section] || []);
  bindFormEvents(section);
  onDataChange();
}

function moveEntry(section, index, direction) {
  const arr = currentSections[section];
  if (!arr) return;
  const newIdx = index + direction;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
  removeEntry.__proto__ = null; // prevent recursive call issues
  const body = document.getElementById(`formBody-${section}`);
  const meta = SECTION_META[section];
  const fieldMap = {
    experience: ['title','company','location','startDate','endDate','current','description'],
    education: ['degree','school','field','startDate','endDate','gpa'],
    projects: ['name','technologies','url','description'],
    certifications: ['name','issuer','year','url'],
    languages: ['language','proficiency'],
    custom: ['name','description']
  };
  if (body) body.innerHTML = listFormHTML(section, meta?.label || section, fieldMap[section] || []);
  bindFormEvents(section);
  onDataChange();
}

// ── Styling Controls ──
function initStyleControls() {
  // Template selection
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      currentTemplate = card.dataset.template;
      renderPreview();
      onDataChange(); // Trigger autosave to database
    });
  });

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStyling.primaryColor = btn.dataset.color;
      onDataChange();
    });
    if (btn.dataset.color === (currentStyling.primaryColor || '#6366f1')) {
      btn.classList.add('active');
    }
  });

  // Custom color picker
  const colorPicker = document.getElementById('customColorPicker');
  if (colorPicker) {
    colorPicker.value = currentStyling.primaryColor || '#6366f1';
    colorPicker.addEventListener('change', () => {
      document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
      currentStyling.primaryColor = colorPicker.value;
      onDataChange();
    });
  }

  // Font selector
  const fontSel = document.getElementById('fontSelector');
  if (fontSel) {
    fontSel.value = currentStyling.font || 'Inter';
    fontSel.addEventListener('change', () => {
      currentStyling.font = fontSel.value;
      onDataChange();
    });
  }
}

// ── Template Switcher ──
document.getElementById('templateSelectorMini')?.addEventListener('click', openTemplateModal);

function openTemplateModal() {
  const modal = document.getElementById('templateModal');
  const gallery = document.getElementById('templateGallery');
  
  const templates = [
    { id: 'manhattan', name: 'Manhattan', badge: 'Professional' },
    { id: 'silicon', name: 'Silicon', badge: 'Modern' },
    { id: 'artisan', name: 'Artisan', badge: 'Creative' },
    { id: 'horizon', name: 'Horizon', badge: 'Modern' },
    { id: 'executive', name: 'Executive', badge: 'Professional' },
    { id: 'classic', name: 'Classic', badge: 'Professional' }
  ];

  if (gallery) {
    gallery.innerHTML = templates.map(t => `
      <div class="template-gallery-card ${currentTemplate === t.id ? 'selected' : ''}" onclick="switchTemplate('${t.id}')">
        <div class="template-gallery-thumb live-preview-builder" data-template="${t.id}"></div>
        <div class="template-gallery-info">
          <span>${t.name}</span>
          <span class="badge badge-muted" style="font-size:10px">${t.badge}</span>
        </div>
      </div>
    `).join('');
    
    // Render thumbs
    const sampleData = {
      personal: { fullName: 'Alexandra Chen', email: 'alex.chen@example.com', phone: '+1 (555) 123-4567', location: 'San Francisco, CA', linkedin: 'linkedin.com/in/alexchen', summary: 'Experienced Software Engineer with 6+ years building scalable web applications. Passionate about clean code and developer experience.' },
      experience: [{ title: 'Senior Software Engineer', company: 'Stripe', location: 'San Francisco, CA', startDate: '2021-03', endDate: '', current: true, description: '• Led development of payment processing API serving 50M+ transactions/day\n• Reduced system latency by 40% through architectural improvements\n• Mentored team of 5 junior engineers' }],
      education: [{ degree: 'B.S. Computer Science', school: 'UC Berkeley', field: 'Computer Science', startDate: '2014-09', endDate: '2018-05' }],
      skills: { technical: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'AWS'], soft: ['Leadership', 'Communication'] },
      projects: [], certifications: [], languages: []
    };
    
    // Clean up any previous live preview inners/observers first
    if (!window._templatePreviewInners) window._templatePreviewInners = [];
    if (!window._templatePreviewObservers) window._templatePreviewObservers = [];
    (window._templatePreviewObservers || []).forEach(o => { try { o.disconnect(); } catch(e){} });
    (window._templatePreviewInners || []).forEach(n => { try { n.remove(); } catch(e){} });
    window._templatePreviewInners = [];
    window._templatePreviewObservers = [];

    document.querySelectorAll('.live-preview-builder').forEach(container => {
      const templateId = container.dataset.template;
      const rendered = renderPreviewHTML(sampleData, { primaryColor: '#6366f1', font: 'Inter' }, templateId);
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      container.style.padding = '0';
      container.style.background = 'white';
      container.style.contain = 'content';
      
      const inner = document.createElement('div');
      inner.className = 'template-preview-inner';
      inner.innerHTML = rendered;
      // keep the preview anchored inside the thumbnail
      inner.style.position = 'absolute';
      inner.style.top = '0';
      inner.style.left = '0';
      inner.style.width = '800px';
      inner.style.transformOrigin = 'top left';
      inner.style.pointerEvents = 'none';
      container.appendChild(inner);
      // Keep track so we can clean up when closing modal
      window._templatePreviewInners.push(inner);

      const resize = () => {
        const width = container.clientWidth || 120;
        const scale = Math.max(0.08, Math.min(1, width / 800));
        inner.style.transform = `scale(${scale})`;
        // ensure the container hides overflow so the large virtual size doesn't spill
        container.style.overflow = 'hidden';
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      window._templatePreviewObservers.push(observer);
      resize();
    });
  }

  modal.classList.remove('hidden');
}

function closeTemplateModal() {
  const modal = document.getElementById('templateModal');
  if (modal) modal.classList.add('hidden');
  // clean up any live preview inners/observers
  if (window._templatePreviewObservers) {
    window._templatePreviewObservers.forEach(o => { try { o.disconnect(); } catch(e){} });
    window._templatePreviewObservers = [];
  }
  if (window._templatePreviewInners) {
    window._templatePreviewInners.forEach(n => { try { n.remove(); } catch(e){} });
    window._templatePreviewInners = [];
  }
}

function switchTemplate(templateId) {
  currentTemplate = templateId;
  document.getElementById('currentTemplateName').textContent =
    templateId.charAt(0).toUpperCase() + templateId.slice(1);
  closeTemplateModal();
  renderPreview(currentSections, currentStyling, currentTemplate);
  onDataChange();
  showToast(`Switched to ${templateId} template`, 'success');
}

// ── AI Panel ──
function toggleAIPanel() {
  const panel = document.getElementById('aiPanel');
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  panel.setAttribute('aria-hidden', isOpen);
}

async function aiGenerateSummary() {
  showAIResults('Generating summary...', 'loading');
  try {
    const data = await API.ai.generateSummary({
      sections: currentSections,
      jobTitle: currentSections.experience?.[0]?.title
    });
    showAIResults(`<div style="line-height:1.6">${data.summary?.summary || data.summary}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="applySummary('${escapeForAttr(data.summary?.summary || data.summary)}')">Apply to Resume</button>`, 'AI Summary');
  } catch (err) {
    showAIResults(friendlyAIError(err), 'error');
  }
}

async function aiSuggestSkills() {
  showAIResults('Suggesting skills...', 'loading');
  try {
    const data = await API.ai.suggestSkills({
      jobTitle: currentSections.experience?.[0]?.title || 'Professional',
      experience: currentSections.experience,
      existingSkills: currentSections.skills?.technical || []
    });
    const skills = data.skills || [];
    showAIResults(`
      <div style="margin-bottom:8px;font-size:var(--text-xs);color:var(--text-muted)">Click a skill to add it:</div>
      <div>${skills.map(s => `<span class="tag-item" style="cursor:pointer;margin:2px;display:inline-block" onclick="addSkill('technical','${esc(s)}')">${esc(s)} +</span>`).join('')}</div>
    `, 'Suggested Skills');
  } catch (err) {
    showAIResults(friendlyAIError(err), 'error');
  }
}

async function aiCheckATS() {
  showAIResults('Analyzing resume...', 'loading');
  try {
    const jobDescription = [
      currentSections.personal?.targetRole,
      currentSections.experience?.[0]?.title,
      currentSections.personal?.summary
    ].filter(Boolean).join(' | ');

    const data = await API.ai.atsScore({ sections: currentSections, jobDescription });
    const analysis = data.analysis || data;
    const score = analysis.score || data.score || 0;
    const scoreColor = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
    
    let html = `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:2.5rem;font-weight:800;color:${scoreColor}">${score}%</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">ATS Score${analysis.industry ? ` · ${esc(analysis.industry)}` : ''}</div>
      </div>
      <div class="ats-progress-bar">
        <div class="ats-progress-fill" style="width: 0%; background: ${scoreColor}"></div>
      </div>
    `;

    if (analysis.keywords_found && analysis.keywords_found.length > 0) {
      html += `<div style="margin-top:12px"><strong>Keywords Matched:</strong></div><div>`;
      html += analysis.keywords_found.map(k => `<span class="ats-tag found">✓ ${esc(k)}</span>`).join('');
      html += `</div>`;
    }
    
    if (analysis.keywords_missing && analysis.keywords_missing.length > 0) {
      html += `<div style="margin-top:8px"><strong>Keywords Missing:</strong></div><div>`;
      html += analysis.keywords_missing.map(k => `<span class="ats-tag missing">+ ${esc(k)}</span>`).join('');
      html += `</div>`;
    }

    if (analysis.strengths && analysis.strengths.length > 0) {
      html += `<div style="margin-top:12px"><strong>✅ Strengths:</strong></div>`;
      html += analysis.strengths.map(s => `<div class="suggestion-item">• ${esc(s)}</div>`).join('');
    }

    if (analysis.improvements && analysis.improvements.length > 0) {
      html += `<div style="margin-top:12px"><strong>🎯 Improvements:</strong></div>`;
      html += analysis.improvements.map(s => `<div class="suggestion-item">• ${esc(s)}</div>`).join('');
    }

    showAIResults(html, 'ATS Analysis');
    
    // Animate progress bar
    setTimeout(() => {
      const fill = document.querySelector('.ats-progress-fill');
      if (fill) fill.style.width = `${score}%`;
    }, 50);

    const atsEl = document.getElementById('atsScoreValue');
    if (atsEl) atsEl.textContent = `${score}%`;
    if (resumeData?.id) API.resumes.update(resumeData.id, { ats_score: score }).catch(() => {});
  } catch (err) {
    showAIResults(friendlyAIError(err), 'error');
  }
}

async function aiOptimize() {
  showAIResults('Analyzing your resume...', 'loading');
  try {
    const data = await API.ai.optimize({ sections: currentSections });
    showAIResults(`
      ${(data.suggestions||[]).map(s => `
        <div class="suggestion-item">
          <span class="badge badge-${s.priority==='high'?'danger':s.priority==='medium'?'warning':'muted'}" style="font-size:10px;flex-shrink:0">${s.priority}</span>
          <span>${esc(s.suggestion)}</span>
        </div>
      `).join('')}
    `, 'Optimization Tips');
  } catch (err) {
    showAIResults(friendlyAIError(err), 'error');
  }
}

async function aiRewriteField(field, content, section) {
  if (!content) { showToast('No content to rewrite', 'warning'); return; }
  
  const tone = window.prompt("Choose tone for rewrite:\n(e.g., Professional, Executive, Direct, Creative, Concise)", "Professional");
  if (!tone) return; // User cancelled
  
  try {
    showToast(`Rewriting with AI (${tone} tone)...`, 'info', 2000);
    const data = await API.ai.rewrite({ content, context: section, tone });
    if (data.rewritten && data.rewritten !== content) {
      const selector = `[data-field="${field}"]`;
      const el = document.querySelector(selector);
      if (el) {
        el.value = data.rewritten;
        el.dispatchEvent(new Event('input'));
      }
      showToast('Content rewritten with AI ✨', 'success');
    }
  } catch (err) {
    showToast(friendlyAIError(err), 'error');
  }
}

function friendlyAIError(err) {
  const msg = err?.message || '';
  if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('not logged')) {
    return '🔐 Please <a href="auth.html" style="color:var(--primary)">sign in</a> to use AI features.';
  }
  if (msg.includes('fetch') || msg.includes('connect') || msg.includes('ECONNREFUSED') || msg.includes('5001')) {
    return '⚠️ Backend server not reachable. Make sure it\'s running on port 5001.';
  }
  if (msg.includes('API key') || msg.includes('GEMINI')) {
    return '🔑 AI requires a Gemini API key. Add GEMINI_API_KEY to backend/.env';
  }
  return `❌ ${msg || 'AI request failed. Please try again.'}`;
}

function showAIResults(content, title) {
  const results = document.getElementById('aiResults');
  const titleEl = document.getElementById('aiResultsTitle');
  const contentEl = document.getElementById('aiResultsContent');
  results.style.display = 'block';
  if (titleEl) titleEl.textContent = title === 'loading' ? '⏳ Working...' : title;
  if (contentEl) contentEl.innerHTML = content;
}

function applySummary(summary) {
  const textarea = document.getElementById('p-summary');
  if (textarea) {
    textarea.value = decodeURIComponent(summary);
    if (!currentSections.personal) currentSections.personal = {};
    currentSections.personal.summary = textarea.value;
    onDataChange();
    showToast('Summary applied!', 'success');
  }
}

function escapeForAttr(s) {
  return encodeURIComponent(String(s||''));
}

// ── Data Change Handler ──
function onDataChange() {
  renderPreview(currentSections, currentStyling, currentTemplate);

  const title = document.getElementById('resumeTitle').value;
  triggerAutosave(currentSections, currentStyling, title, currentTemplate);
}

// ── Event Listeners ──
function initEventListeners(resumeId) {
  // Title change
  document.getElementById('resumeTitle').addEventListener('input', (e) => {
    triggerAutosave(currentSections, currentStyling, e.target.value, currentTemplate);
  });

  // Export menu toggle
  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = exportMenu.style.display !== 'none';
    exportMenu.style.display = isOpen ? 'none' : 'block';
    exportBtn.setAttribute('aria-expanded', !isOpen);
  });
  document.addEventListener('click', () => {
    if (exportMenu) exportMenu.style.display = 'none';
  });

  // Export PDF
  document.getElementById('exportPDFBtn')?.addEventListener('click', async () => {
    if (!isLocal) {
      showToast('Generating PDF directly in browser...', 'info');
      const element = document.getElementById('resumePreview');
      if (!element) return;
      
      const opt = {
        margin:       [0, 0, 0, 0],
        filename:     `${(document.getElementById('resumeTitle').value || 'resume').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      
      // Ensure the preview panel is visible for html2canvas to capture it
      if (window.innerWidth <= 900) {
        if (typeof switchMobileTab === 'function') switchMobileTab('preview');
      }

      // Add a slight delay to ensure DOM reflows before capture
      setTimeout(() => {
        // Temporarily remove transform scaling for clean capture
        const originalTransform = element.style.transform;
        element.style.transform = 'none';
        
        const worker = html2pdf().set(opt).from(element);
        
        worker.save().then(() => {
          element.style.transform = originalTransform;
          showToast('PDF downloaded successfully!', 'success');
        }).catch(err => {
          element.style.transform = originalTransform;
          console.error('PDF generation error:', err);
          showToast('Failed to generate PDF', 'error');
        });

        // Background upload to storage
        if (typeof resumeId !== 'undefined' && resumeId && typeof supabaseClient !== 'undefined') {
          worker.outputPdf('blob').then(async (blob) => {
            try {
              await supabaseClient.storage.from('resumes').upload(`${resumeId}/resume.pdf`, blob, { 
                upsert: true, 
                contentType: 'application/pdf' 
              });
            } catch (err) {
              console.error('Storage upload error:', err);
            }
          }).catch(e => console.error('Background PDF upload error:', e));
        }
      }, 100);
      return;
    }
    
    if (!(await Auth.isLoggedIn())) {
      forceSave(currentSections, currentStyling, document.getElementById('resumeTitle').value, currentTemplate);
      window.location.href = 'auth.html?returnTo=' + encodeURIComponent('builder.html?export=true');
      return;
    }
    if (resumeId) {
      showToast('Generating PDF...', 'info');
      try {
        const url = await API.resumes.exportPDF(resumeId);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Server error generating PDF');
        
        const blob = await response.blob();
        let filename = `${(document.getElementById('resumeTitle').value || 'resume').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition && contentDisposition.includes('filename="')) {
          filename = contentDisposition.split('filename="')[1].split('"')[0];
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);
        showToast('PDF downloaded successfully!', 'success');
      } catch (err) {
        console.error('Fetch PDF error', err);
        showToast('Failed to download PDF. Try again.', 'error');
      }
    }
  });

  // Export DOCX (or .doc fallback)
  document.getElementById('exportDOCXBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    const token = Auth.getCachedToken ? Auth.getCachedToken() : null;
    
    (async () => {
      if (!(await Auth.isLoggedIn())) {
        forceSave(currentSections, currentStyling, document.getElementById('resumeTitle').value, currentTemplate);
        window.location.href = 'auth.html?returnTo=' + encodeURIComponent('builder.html?export=true');
        return;
      }
      
      if (!resumeId) {
        showToast('Please save your resume first', 'warning');
        return;
      }

      showToast('Generating DOCX...', 'info');
      const url = await API.resumes.exportDOCX(resumeId);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Server error generating DOCX');
        }
        const blob = await response.blob();
        
        // Extract filename from Content-Disposition if present
        let filename = `${(document.getElementById('resumeTitle').value || 'resume').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition && contentDisposition.includes('filename="')) {
          filename = contentDisposition.split('filename="')[1].split('"')[0];
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(downloadUrl);
        showToast('DOCX downloaded successfully!', 'success');
      } catch (err) {
        console.error('Fetch DOCX error', err);
        // Fallback to direct navigation
        window.location.href = url;
      }
    })().catch(err => {
      showToast('Failed to download DOCX: ' + (err.message || err), 'error');
      console.error('DOCX download error', err);
    });
  });

  // Print
  // Print
  document.getElementById('printBtn')?.addEventListener('click', async () => {
    const preview = document.getElementById('resumePreview');
    if (!preview) return;
    
    if (!(await Auth.isLoggedIn())) {
      if (typeof forceSave === 'function') {
        forceSave(currentSections, currentStyling, document.getElementById('resumeTitle').value, currentTemplate);
      }
      window.location.href = 'auth.html?returnTo=' + encodeURIComponent('builder.html?print=true');
      return;
    }
    
    // Use in-page print to avoid popup blockers
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.innerHTML = preview.innerHTML;
    
    const printStyle = document.createElement('style');
    printStyle.id = 'print-style';
    printStyle.textContent = `
      @media print {
        body > *:not(#print-container) { display: none !important; }
        #print-container { display: block !important; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
      #print-container { display: none; }
    `;
    
    document.body.appendChild(printContainer);
    document.head.appendChild(printStyle);
    
    setTimeout(() => {
      window.print();
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(printContainer);
        document.head.removeChild(printStyle);
      }, 500);
    }, 100);
  });

  // Share
  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    if (!(await Auth.isLoggedIn())) {
      forceSave(currentSections, currentStyling, document.getElementById('resumeTitle').value, currentTemplate);
      window.location.href = 'auth.html?returnTo=' + encodeURIComponent('builder.html');
      return;
    }
    try {
      const data = await API.resumes.share(resumeId);
      await navigator.clipboard.writeText(data.shareUrl);
      showToast('Share link copied! 🔗', 'success');
    } catch {
      showToast('Could not generate share link', 'error');
    }
  });

  // Fullscreen preview
  document.getElementById('fullscreenPreviewBtn')?.addEventListener('click', () => {
    const doc = document.getElementById('previewDocument');
    if (doc) {
      const scale = doc.style.transform === 'scale(1)' ? 'scale(0.85)' : 'scale(1)';
      doc.style.transform = scale;
    }
  });

  // Sections collapse toggle
  document.getElementById('sectionsToggle')?.addEventListener('click', () => {
    document.getElementById('sectionsPanel').style.display =
      document.getElementById('sectionsPanel').style.display === 'none' ? '' : 'none';
  });

  // Template modal close
  document.getElementById('templateModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('templateModal')) closeTemplateModal();
  });

  // Add section
  window.showAddSectionMenu = function() {
    const defaultActive = Object.keys(SECTION_META).filter(k => k !== 'custom');
    const inactive = Object.keys(SECTION_META).filter(key => {
      const active = new Set(currentSections.activeSections || defaultActive);
      return !active.has(key);
    });

    if (inactive.length === 0) {
      showToast('All sections are already added', 'info');
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'dropdown-menu';
    menu.style.cssText = 'position:fixed;bottom:80px;left:var(--space-5);z-index:999;min-width:180px';
    menu.innerHTML = inactive.map(key => `
      <button class="dropdown-item" onclick="addSectionToResume('${key}')">
        ${SECTION_META[key].icon} ${SECTION_META[key].label}
      </button>`).join('');

    document.body.appendChild(menu);
    setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
  };

  window.addSectionToResume = function(key) {
    const active = currentSections.activeSections || Object.keys(SECTION_META).filter(k => k !== 'custom');
    if (!active.includes(key)) {
      currentSections.activeSections = [...active, key];
      if (!currentSections.sectionOrder) currentSections.sectionOrder = Object.keys(SECTION_META);
      if (!currentSections.sectionOrder.includes(key)) currentSections.sectionOrder.push(key);
      initSectionsList();
      renderActiveSectionForm();
      setActiveSection(key);
      onDataChange();
    }
  };

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (document.querySelector('.autosave-indicator.typing')) {
      e.preventDefault();
    }
  });
}
