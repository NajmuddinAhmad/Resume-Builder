/**
 * Build My Resume — Landing Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Update nav if logged in
  if (typeof Auth !== 'undefined') {
    Auth.isLoggedIn().then(loggedIn => {
      if (loggedIn) {
        document.querySelectorAll('.btn-primary[href="auth.html"]').forEach(btn => {
          btn.href = 'dashboard.html';
          btn.textContent = 'Go to Dashboard →';
        });
        document.querySelectorAll('a[href="auth.html"]').forEach(link => {
          if (!link.classList.contains('btn-primary')) link.href = 'dashboard.html';
        });
      }
    });
  }

  // ── Navbar scroll effect ──
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile menu ──
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.querySelector('.nav-links');
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      mobileBtn.setAttribute('aria-expanded', isOpen);
    });
    // Close on link click
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // ── Scroll animations ──
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }),
    { threshold: 0.1 }
  );

  document.querySelectorAll('.feature-card, .step-item').forEach(el => observer.observe(el));

  // ── Counter animations ──
  document.querySelectorAll('.stat-item strong[data-target]').forEach(el => {
    animateCounter(el, parseInt(el.dataset.target, 10));
  });
});

function animateCounter(el, target) {
  let current = 0;
  const step = Math.ceil(target / 60);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = formatCounterValue(current, el.dataset.suffix || '');
    if (current >= target) clearInterval(interval);
  }, 16);
}

function formatCounterValue(n, suffix) {
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n/1000).toFixed(0)}K`;
  return n + suffix;
}
