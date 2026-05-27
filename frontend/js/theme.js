/**
 * Build My Resume — Theme Manager
 * Handles dark/light mode toggle with persistence
 */

const THEME_KEY = 'buildmyresume_theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  // Update all theme toggle buttons
  document.querySelectorAll('.icon-sun, .icon-moon').forEach(icon => {
    const isSun = icon.classList.contains('icon-sun');
    icon.style.display = (theme === 'dark' ? !isSun : isSun) ? 'block' : 'none';
  });

  // Update flatpickr theme if it exists
  const fpTheme = document.getElementById('flatpickr-theme');
  if (fpTheme) {
    fpTheme.href = theme === 'dark'
      ? 'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/dark.css'
      : 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Apply on load
applyTheme(getPreferredTheme());

// Bind all theme toggle buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#themeToggle, #authThemeToggle, #dashThemeToggle, #builderThemeToggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
});

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem(THEME_KEY)) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});
