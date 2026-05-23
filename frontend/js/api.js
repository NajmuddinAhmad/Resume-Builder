const SUPABASE_URL = 'https://aihmhvlhthfodikgzfsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaG1odmxodGhmb2Rpa2d6ZnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY4NDAsImV4cCI6MjA5NDg0Mjg0MH0.AEgff0NpZLHr_B2MHx6sFB9V2wNcpLURBveOrMCm2to';

// Connect to local backend during development, or Vercel serverless API in production
const isLocalEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalEnv ? 'http://localhost:5001/api' : '/api';
const AUTH_REDIRECT_URL = `${window.location.origin}/auth.html?tab=login`;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let cachedAuthToken = null;

// ── Auth Management ──
const Auth = {
  getSession: async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    cachedAuthToken = session?.access_token || null;
    return session;
  },
  getToken: async () => {
    const session = await Auth.getSession();
    return session?.access_token || null;
  },
  getCachedToken: () => cachedAuthToken,
  getUser: async () => {
    const session = await Auth.getSession();
    return session?.user || null;
  },
  isLoggedIn: async () => {
    const session = await Auth.getSession();
    return !!session;
  },
  redirectIfNotLoggedIn: async () => {
    const loggedIn = await Auth.isLoggedIn();
    if (!loggedIn) {
      window.location.href = 'auth.html';
      return true;
    }
    return false;
  }
};

// ── Core Request Function (For Node.js Backend endpoints like AI/PDF) ──
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = await Auth.getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...options, headers });
    return handleResponse(res);
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      if (isLocalEnv) {
        throw new Error('Cannot connect to local server. Make sure the backend is running on port 5001.');
      } else {
        throw new Error('Network error. Cannot connect to the server (check connection or adblockers).');
      }
    }
    throw err;
  }
}

async function handleResponse(res) {
  const contentType = res.headers.get('Content-Type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();

  if (!res.ok) {
    const errMsg = (isJson && data.error) ? data.error
      : (isJson && data.errors) ? data.errors.map(e => e.msg).join(', ')
      : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data;
}

// ── API Methods ──
const deletedIds = new Set();
const API = {
  // Auth
  auth: {
    signup: async (data) => {
      const { data: authData, error } = await supabaseClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name },
          emailRedirectTo: AUTH_REDIRECT_URL
        }
      });
      if (error) throw error;
      return authData;
    },
    resendVerification: async (email) => {
      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: AUTH_REDIRECT_URL
        }
      });
      if (error) throw error;
    },
    login: async (data) => {
      const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });
      if (error) throw error;
      return authData;
    },
    forgotPassword: async (email) => {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: AUTH_REDIRECT_URL
      });
      if (error) throw error;
    },
    resetPassword: async (password) => {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
    },
    me: async () => {
      const { data, error } = await supabaseClient.auth.getUser();
      if (error) throw error;
      return data;
    },
    logout: async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    }
  },

  // Resumes
  resumes: {
    list: async (params = {}) => {
        try {
          const { data: { user } } = await supabaseClient.auth.getUser();
          if (!user) return { resumes: [] };

          let query = supabaseClient.from('resumes').select('*');
          if (params.search) query = query.ilike('title', `%${params.search}%`);
          const sortField = params.sort || 'updated_at';
          const ascending = sortField === 'title';
          query = query.order(sortField, { ascending });

          const { data, error } = await query;
          if (error) throw error;

          let filtered = data.filter(r => !deletedIds.has(r.id));
          if (params.filter === 'recent') {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(r => new Date(r.updated_at) >= oneWeekAgo);
          } else if (params.filter === 'shared') {
            filtered = filtered.filter(r => r.is_public);
          }
          return { resumes: filtered };
        } catch (err) {
          // Fall back to backend API when Supabase client is blocked by RLS/policies
          const query = new URLSearchParams(params).toString();
          const res = await request(`/resumes?${query}`, { method: 'GET' });
          return { resumes: res.resumes || [] };
        }
    },
    create: async (resumeData = {}) => {
      // Prefer client-side insert via Supabase where RLS/policies allow.
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('Not logged in');

        const { data, error } = await supabaseClient.from('resumes').insert([{
          user_id: user.id,
          title: resumeData.title || 'Untitled Resume',
          template_id: resumeData.template_id || 'manhattan',
          sections: resumeData.sections || {},
          styling: resumeData.styling || {}
        }]).select().single();

        if (error) throw error;
        return { resume: data };
      } catch (err) {
        // If Supabase insertion is blocked (RLS or permission), fall back to backend API
        const fallbackMsg = (err && err.message) ? err.message.toLowerCase() : '';
        if (fallbackMsg.includes('not logged in') || fallbackMsg.includes('permission') || fallbackMsg.includes('forbidden') || fallbackMsg.includes('policy') || fallbackMsg.includes('authentication')) {
          // Backend will authenticate the request using the Supabase JWT and create a local DB row
          const payload = {
            title: resumeData.title || 'Untitled Resume',
            template_id: resumeData.template_id || 'manhattan',
            sections: resumeData.sections || {},
            styling: resumeData.styling || {}
          };
          const data = await request('/resumes', { method: 'POST', body: JSON.stringify(payload) });
          return { resume: data.resume };
        }
        throw err;
      }
    },
    get: async (id) => {
      try {
        const { data, error } = await supabaseClient.from('resumes').select('*').eq('id', id).single();
        if (error) throw error;
        return { resume: data };
      } catch (err) {
        const data = await request(`/resumes/${id}`, { method: 'GET' });
        return { resume: data.resume };
      }
    },
    update: async (id, resumeData) => {
      try {
        const { data, error } = await supabaseClient.from('resumes').update(resumeData).eq('id', id).select().single();
        if (error) throw error;
        return { resume: data };
      } catch (err) {
        const data = await request(`/resumes/${id}`, { method: 'PUT', body: JSON.stringify(resumeData) });
        return { resume: data.resume };
      }
    },
    delete: async (id) => {
      try {
        const { error } = await supabaseClient.from('resumes').delete().eq('id', id);
        if (error) throw error;
        deletedIds.add(id);
        return { success: true };
      } catch (err) {
        const fallbackMsg = (err && err.message) ? err.message.toLowerCase() : '';
        if (fallbackMsg.includes('not logged in') || fallbackMsg.includes('permission') || fallbackMsg.includes('forbidden') || fallbackMsg.includes('policy') || fallbackMsg.includes('authentication')) {
          await request(`/resumes/${id}`, { method: 'DELETE' });
          deletedIds.add(id);
          return { success: true };
        }
        throw err;
      }
    },
    duplicate: async (id) => {
      const { data: orig, error: err1 } = await supabaseClient.from('resumes').select('*').eq('id', id).single();
      if (err1) throw err1;
      const { id: _, created_at, updated_at, ...copyData } = orig;
      copyData.title = copyData.title + ' (Copy)';
      const { data, error } = await supabaseClient.from('resumes').insert([copyData]).select().single();
      if (error) throw error;
      return { resume: data };
    },
    exportPDF: async (id) => {
      const token = await Auth.getToken();
      return `${API_BASE}/resumes/${id}/export/pdf?token=${token}`;
    },
    exportDOCX: async (id) => {
      const token = await Auth.getToken();
      return `${API_BASE}/resumes/${id}/export/docx?token=${token}`;
    },
    // Download DOCX via fetch (uses Authorization header when available)
    downloadDOCX: async (id) => {
      const token = await Auth.getToken();
      const url = `${API_BASE}/resumes/${id}/export/docx`;
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const blob = await res.blob();
      // Try to extract filename from Content-Disposition
      const cd = res.headers.get('Content-Disposition') || '';
      let filename = 'resume.docx';
      const m = /filename\*=UTF-8''([^;\n]+)/i.exec(cd) || /filename="?([^";\n]+)"?/i.exec(cd);
      if (m && m[1]) filename = decodeURIComponent(m[1]);
      return { blob, filename };
    },
    share: async (id, isPublic = true) => {
      const share_token = Math.random().toString(36).substring(2, 15);
      const { data, error } = await supabaseClient.from('resumes').update({ is_public: isPublic, share_token }).eq('id', id).select().single();
      if (error) throw error;
      return { shareUrl: `${window.location.origin}/builder.html?id=${id}&share=${share_token}` };
    },
    stats: async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        return {
          stats: {
            total_resumes: 0,
            avg_ats_score: 0,
            total_downloads: 0,
            total_views: 0
          }
        };
      }
      const { data, error } = await supabaseClient.from('resumes').select('ats_score, downloads, views').eq('user_id', user.id);
      if (error) throw error;
      
      let total_resumes = data.length;
      let total_downloads = 0;
      let total_views = 0;
      let ats_sum = 0;
      let ats_count = 0;
      
      data.forEach(r => {
        total_downloads += (r.downloads || 0);
        total_views += (r.views || 0);
        if (r.ats_score > 0) {
          ats_sum += r.ats_score;
          ats_count++;
        }
      });
      
      let avg_ats_score = ats_count > 0 ? Math.round(ats_sum / ats_count) : 0;
      
      return {
        stats: {
          total_resumes,
          avg_ats_score,
          total_downloads,
          total_views
        }
      };
    }
  },

  // Templates
  templates: {
    list: async () => {
      const { data, error } = await supabaseClient.from('templates').select('*');
      if (error) throw error;
      return { templates: data };
    }
  },

  // AI (Mocked for frontend-only execution)
  ai: {
    generateSummary: async (data) => request('/assistant/summary', { method: 'POST', body: JSON.stringify(data) }),
    suggestSkills: async (data) => request('/assistant/skills', { method: 'POST', body: JSON.stringify(data) }),
    atsScore: async (data) => request('/assistant/ats-score', { method: 'POST', body: JSON.stringify(data) }),
    rewrite: async (data) => request('/assistant/rewrite', { method: 'POST', body: JSON.stringify(data) }),
    optimize: async (data) => request('/assistant/optimize', { method: 'POST', body: JSON.stringify(data) })
  }
};

// ── Toast Notifications ──
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Dismiss">×</button>
  `;

  container.appendChild(toast);

  const dismiss = () => {
    toast.style.animation = 'slideInRight 0.3s reverse both';
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

// ── Loading State Helper ──
function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : '';
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

// ── Format Date ──
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Get initials from name ──
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
