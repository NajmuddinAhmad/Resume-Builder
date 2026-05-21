/**
 * Build My Resume — Auth Page JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect to dashboard
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get('returnTo');
  const redirectTarget = returnTo ? decodeURIComponent(returnTo) : 'dashboard.html';
  let lastSignupEmail = '';
  const VERIFICATION_COOLDOWN_MS = 60 * 1000;

  function cooldownKey(email, action) {
    return `auth:${action}:${String(email).trim().toLowerCase()}`;
  }

  function canSendVerification(email, action) {
    const key = cooldownKey(email, action);
    const lastSentAt = Number(localStorage.getItem(key) || 0);
    return !lastSentAt || (Date.now() - lastSentAt) >= VERIFICATION_COOLDOWN_MS;
  }

  function markVerificationSent(email, action) {
    localStorage.setItem(cooldownKey(email, action), String(Date.now()));
  }

  function cooldownMessage(seconds) {
    return `Please wait ${seconds}s before requesting another verification email.`;
  }

  Auth.isLoggedIn().then(loggedIn => {
    if (loggedIn) {
      window.location.href = redirectTarget;
    }
  });
  if (params.get('tab') === 'signup') switchTab('signup');

  const resetToken = params.get('reset');
  if (resetToken) showResetForm(resetToken);

  // ── Tab Switching ──
  document.getElementById('loginTab').addEventListener('click', () => switchTab('login'));
  document.getElementById('signupTab').addEventListener('click', () => switchTab('signup'));

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) => {
      t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'signup'));
      t.setAttribute('aria-selected', ((i === 0 && tab === 'login') || (i === 1 && tab === 'signup')).toString());
    });
    document.querySelectorAll('.auth-form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(tab + 'Panel').classList.add('active');
    history.replaceState({}, '', tab === 'signup' ? '?tab=signup' : '?tab=login');
  }

  // ── Forgot Password ──
  document.getElementById('forgotBtn').addEventListener('click', () => {
    document.querySelectorAll('.auth-form-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('forgotPanel').classList.add('active');
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  });

  document.getElementById('backToLogin').addEventListener('click', () => {
    switchTab('login');
  });

  // ── Password Toggles ──
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // ── Password Strength ──
  const signupPassword = document.getElementById('signupPassword');
  if (signupPassword) {
    signupPassword.addEventListener('input', updateStrength);
  }

  function updateStrength() {
    const val = signupPassword.value;
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    if (!fill) return;

    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = ['', 'weak', 'fair', 'good', 'strong', 'strong'];
    const labels = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong 💪', 'Very Strong 🔒'];

    fill.className = 'strength-fill ' + (levels[score] || '');
    label.textContent = val ? labels[Math.min(score, 5)] : labels[0];
  }

  // ── Login Form ──
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginSubmit');
    const errEl = document.getElementById('loginError');

    errEl.classList.add('hidden');
    setLoading(btn, true);

    try {
      const data = await API.auth.login({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value
      });

      showToast('Welcome back! Redirecting...', 'success');
      setTimeout(() => window.location.href = redirectTarget, 800);
    } catch (err) {
      if (/not confirmed|email.*not verified|confirmation/i.test(err.message)) {
        errEl.textContent = 'Your email still needs verification. Check your inbox or use the Sign Up tab to resend the verification email.';
      } else {
        errEl.textContent = err.message;
      }
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // ── Signup Form ──
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signupSubmit');
    const errEl = document.getElementById('signupError');
    const helpEl = document.getElementById('signupHelp');
    const email = document.getElementById('signupEmail').value.trim();

    errEl.classList.add('hidden');
    helpEl.style.display = 'none';

    if (!document.getElementById('agreeTerms').checked) {
      errEl.textContent = 'Please agree to the Terms of Service and Privacy Policy.';
      errEl.classList.remove('hidden');
      return;
    }

    if (!canSendVerification(email, 'signup')) {
      const waitSeconds = Math.ceil((VERIFICATION_COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(cooldownKey(email, 'signup')) || 0))) / 1000);
      errEl.textContent = cooldownMessage(waitSeconds > 0 ? waitSeconds : 1);
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);

    try {
      const data = await API.auth.signup({
        name: document.getElementById('signupName').value.trim(),
        email,
        password: document.getElementById('signupPassword').value
      });

      if (!data.session) {
        lastSignupEmail = email;
        markVerificationSent(email, 'signup');
        showToast('Account created! Please check your email to confirm your account.', 'info', 8000);
        helpEl.style.display = 'block';
        document.getElementById('signupForm').reset();
      } else {
        showToast('Account created! Redirecting...', 'success');
        setTimeout(() => window.location.href = redirectTarget, 800);
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('resendVerificationBtn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('signupError');
    const helpEl = document.getElementById('signupHelp');
    errEl.classList.add('hidden');

    if (!lastSignupEmail) {
      errEl.textContent = 'Enter your email in the signup form first.';
      errEl.classList.remove('hidden');
      return;
    }

    if (!canSendVerification(lastSignupEmail, 'resend')) {
      const waitSeconds = Math.ceil((VERIFICATION_COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(cooldownKey(lastSignupEmail, 'resend')) || 0))) / 1000);
      errEl.textContent = cooldownMessage(waitSeconds > 0 ? waitSeconds : 1);
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(document.getElementById('signupSubmit'), true);
    try {
      await API.auth.resendVerification(lastSignupEmail);
      markVerificationSent(lastSignupEmail, 'resend');
      showToast('Verification email sent again. Check your inbox and spam folder.', 'success', 7000);
      helpEl.style.display = 'none';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(document.getElementById('signupSubmit'), false);
    }
  });

  // ── Forgot Password Form ──
  document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('forgotSubmit');
    const msgEl = document.getElementById('forgotMessage');
    const errEl = document.getElementById('forgotError');
    const email = document.getElementById('forgotEmail').value.trim();

    errEl.classList.add('hidden');
    msgEl.classList.add('hidden');

    if (!canSendVerification(email, 'forgot')) {
      const waitSeconds = Math.ceil((VERIFICATION_COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(cooldownKey(email, 'forgot')) || 0))) / 1000);
      errEl.textContent = cooldownMessage(waitSeconds > 0 ? waitSeconds : 1);
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);

    try {
      await API.auth.forgotPassword(email);
      markVerificationSent(email, 'forgot');
      msgEl.textContent = '✅ Reset link sent! Check your email inbox.';
      msgEl.classList.remove('hidden');
      document.getElementById('forgotForm').reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  function showResetForm(token) {
    // Could show a password reset panel here
    // For now, handled via URL params
  }
});
