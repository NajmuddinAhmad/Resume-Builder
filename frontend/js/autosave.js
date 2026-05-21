/**
 * Build My Resume — Autosave Service
 * Debounced autosave with visual indicator
 */

let autosaveTimer = null;
let lastSavedData = null;
let isSaving = false;
let resumeId = null;

const AUTOSAVE_DELAY = 1500; // ms

function initAutosave(id) {
  resumeId = id;
}

function triggerAutosave(sections, styling, title, template_id) {
  setAutosaveStatus('typing');
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => performSave(sections, styling, title, template_id), AUTOSAVE_DELAY);
}

async function performSave(sections, styling, title, template_id) {
  if (isSaving) return;

  const dataStr = JSON.stringify({ sections, styling, title, template_id });
  if (dataStr === lastSavedData) {
    setAutosaveStatus('saved');
    return;
  }

  isSaving = true;
  setAutosaveStatus('saving');

  try {
    const loggedIn = await Auth.isLoggedIn();
    if (loggedIn && resumeId) {
      await API.resumes.update(resumeId, { sections, styling, title, template_id });
    } else {
      localStorage.setItem('local_resume_draft', dataStr);
    }
    lastSavedData = dataStr;
    setAutosaveStatus('saved');
  } catch (err) {
    setAutosaveStatus('error');
    console.error('Autosave failed:', err.message);
  } finally {
    isSaving = false;
  }
}

function setAutosaveStatus(status) {
  const indicator = document.getElementById('autosaveIndicator');
  if (!indicator) return;

  const icon = indicator.querySelector('.autosave-icon');
  const text = indicator.querySelector('.autosave-text');

  indicator.className = `autosave-indicator ${status}`;

  const states = {
    saved: { icon: '●', text: 'Saved', color: 'var(--success)' },
    saving: { icon: '↻', text: 'Saving...', color: 'var(--warning)' },
    typing: { icon: '●', text: 'Unsaved', color: 'var(--text-muted)' },
    error: { icon: '●', text: 'Save failed', color: 'var(--danger)' }
  };

  const state = states[status] || states.saved;
  if (icon) { icon.textContent = state.icon; icon.style.color = state.color; }
  if (text) text.textContent = state.text;
}

// Force save immediately (e.g., before navigation)
async function forceSave(sections, styling, title, template_id) {
  clearTimeout(autosaveTimer);
  await performSave(sections, styling, title, template_id);
}
