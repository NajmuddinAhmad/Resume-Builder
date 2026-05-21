/**
 * Build My Resume — Live Preview Renderer
 * Renders resume data into HTML for the preview pane
 */

const TEMPLATE_RENDERERS = {
  manhattan: renderManhattan,
  silicon: renderSilicon,
  artisan: renderArtisan,
  horizon: renderHorizon,
  executive: renderExecutive,
  classic: renderClassic
};

/**
 * Main render function — called whenever data changes
 */
function renderPreview(sections = {}, styling = {}, templateId = 'manhattan') {
  const previewEl = document.getElementById('resumePreview');
  if (previewEl) previewEl.innerHTML = renderPreviewHTML(sections, styling, templateId);
}

function renderPreviewHTML(sections = {}, styling = {}, templateId = 'manhattan') {
  const renderer = TEMPLATE_RENDERERS[templateId] || renderManhattan;
  return renderer(sections, styling);
}

// ── Helpers ──
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
const nl2br = (s) => esc(s).replace(/\n/g,'<br>');

function sectionTitle(label, color) {
  return `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${color};border-bottom:2px solid ${color};padding-bottom:4px;margin:14px 0 8px">${label}</div>`;
}

function customSectionsHTML(customSections = [], color = '#6366f1') {
  if (!Array.isArray(customSections) || !customSections.length) return '';
  return customSections.map(section => {
    if (!section || (!section.name && !section.description)) return '';
    const title = esc(section.name || 'Additional Information');
    const content = section.description ? `<div style="font-size:9pt;color:#374151;line-height:1.6">${nl2br(section.description)}</div>` : '';
    return `${sectionTitle(title, color)}${content}`;
  }).join('');
}

function entryHTML(e) {
  if (!e) return '';
  const title = e.title || e.degree || e.name || e.language || '';
  return `
  <div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-weight:600;font-size:10pt">${esc(title)}</div>
        <div style="color:#64748b;font-size:9pt">${esc(e.company || e.school || '')}${e.location ? ` · ${esc(e.location)}` : ''}</div>
      </div>
      <div style="font-size:9pt;color:#94a3b8;white-space:nowrap">${esc(e.startDate||'')} ${e.startDate ? '–' : ''} ${e.current ? 'Present' : esc(e.endDate||'')}</div>
    </div>
    ${e.description ? `<div style="font-size:9pt;color:#374151;margin-top:4px">${nl2br(e.description)}</div>` : ''}
    ${e.field ? `<div style="font-size:9pt;color:#64748b">${esc(e.field)}</div>` : ''}
    ${e.gpa ? `<div style="font-size:9pt;color:#64748b">GPA: ${esc(e.gpa)}</div>` : ''}
    ${e.technologies ? `<div style="font-size:8.5pt;color:#6366f1;margin-top:2px">${esc(e.technologies)}</div>` : ''}
  </div>`;
}

// ── Manhattan Template ──
function renderManhattan(sections, styling) {
  const p = sections.personal || {};
  const primaryColor = styling.primaryColor || '#6366f1';
  const font = styling.font || 'Inter';
  const exp = sections.experience || [];
  const edu = sections.education || [];
  const skills = sections.skills || {};
  const projects = sections.projects || [];
  const certs = sections.certifications || [];
  const langs = sections.languages || [];
  const custom = sections.custom || [];

  return `
<style>
  @import url('https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: '${font}', sans-serif; font-size: 10pt; color: #1a1a2e; line-height: 1.5; }
</style>
<div style="font-family:'${font}',sans-serif;font-size:10pt;color:#1a1a2e;line-height:1.5">
  <!-- Header -->
  <div style="background:${primaryColor};color:white;padding:24px 28px">
    <div style="font-size:22pt;font-weight:700;letter-spacing:-0.5px">${esc(p.fullName || 'Your Name')}</div>
    <div style="margin-top:6px;font-size:8.5pt;opacity:0.9;display:flex;flex-wrap:wrap;gap:12px">
      ${p.email ? `<span>✉ ${esc(p.email)}</span>` : ''}
      ${p.phone ? `<span>📱 ${esc(p.phone)}</span>` : ''}
      ${p.location ? `<span>📍 ${esc(p.location)}</span>` : ''}
      ${p.linkedin ? `<span>🔗 ${esc(p.linkedin)}</span>` : ''}
      ${p.website ? `<span>🌐 ${esc(p.website)}</span>` : ''}
    </div>
  </div>
  <!-- Body -->
  <div style="display:flex">
    <!-- Main column -->
    <div style="flex:1;padding:20px 24px">
      ${p.summary ? `
        ${sectionTitle('Professional Summary', primaryColor)}
        <p style="font-size:9.5pt;color:#374151;line-height:1.6">${nl2br(p.summary)}</p>
      ` : ''}
      ${exp.length ? `
        ${sectionTitle('Experience', primaryColor)}
        ${exp.map(entryHTML).join('')}
      ` : ''}
      ${edu.length ? `
        ${sectionTitle('Education', primaryColor)}
        ${edu.map(entryHTML).join('')}
      ` : ''}
      ${projects.length ? `
        ${sectionTitle('Projects', primaryColor)}
        ${projects.map(e => `
          <div style="margin-bottom:10px">
            <div style="font-weight:600">${esc(e.name||'')} ${e.url?`<span style="font-size:8pt;color:${primaryColor}">${esc(e.url)}</span>`:''}</div>
            ${e.technologies ? `<div style="font-size:8.5pt;color:#64748b">${esc(e.technologies)}</div>` : ''}
            ${e.description ? `<div style="font-size:9pt;color:#374151;margin-top:3px">${nl2br(e.description)}</div>` : ''}
          </div>`).join('')}
      ` : ''}
      ${customSectionsHTML(custom, primaryColor)}
    </div>
    <!-- Sidebar -->
    <div style="width:200px;background:#f8fafc;padding:20px 16px;border-left:1px solid #e2e8f0">
      ${skills.technical?.length ? `
        ${sectionTitle('Skills', primaryColor)}
        <div>${(skills.technical||[]).map(s => `<span style="display:inline-block;background:${primaryColor}18;color:${primaryColor};border:1px solid ${primaryColor}30;border-radius:4px;padding:2px 8px;font-size:8pt;margin:2px">${esc(s)}</span>`).join('')}</div>
      ` : ''}
      ${skills.soft?.length ? `
        ${sectionTitle('Soft Skills', primaryColor)}
        <div>${(skills.soft||[]).map(s => `<span style="display:inline-block;background:#f1f5f9;color:#475569;border-radius:4px;padding:2px 8px;font-size:8pt;margin:2px">${esc(s)}</span>`).join('')}</div>
      ` : ''}
      ${certs.length ? `
        ${sectionTitle('Certifications', primaryColor)}
        ${certs.map(c => `<div style="margin-bottom:8px"><div style="font-weight:600;font-size:9pt">${esc(c.name||'')}</div><div style="font-size:8pt;color:#64748b">${esc(c.issuer||'')}${c.year?` · ${c.year}`:''}</div></div>`).join('')}
      ` : ''}
      ${langs.length ? `
        ${sectionTitle('Languages', primaryColor)}
        ${langs.map(l => `<div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:4px"><span>${esc(l.language||'')}</span><span style="color:#94a3b8">${esc(l.proficiency||'')}</span></div>`).join('')}
      ` : ''}
    </div>
  </div>
</div>`;
}

// ── Silicon Template ──
function renderSilicon(sections, styling) {
  const p = sections.personal || {};
  const primaryColor = styling.primaryColor || '#6366f1';
  const font = styling.font || 'Inter';
  const exp = sections.experience || [];
  const edu = sections.education || [];
  const skills = sections.skills || {};
  const projects = sections.projects || [];
  const certs = sections.certifications || [];
  const langs = sections.languages || [];
  const custom = sections.custom || [];

  return `
<div style="font-family:'${font}',sans-serif;font-size:10pt;color:#0f172a;line-height:1.6;padding:36px">
  <div style="font-size:24pt;font-weight:700;letter-spacing:-0.5px">${esc(p.fullName || 'Your Name')}</div>
  <div style="color:#64748b;font-size:9pt;margin-top:4px">${[p.email,p.phone,p.location,p.linkedin].filter(Boolean).map(esc).join(' · ')}</div>
  <div style="border-top:2px solid ${primaryColor};margin:16px 0"></div>
  ${p.summary ? `<p style="font-size:9.5pt;color:#374151;margin-bottom:16px">${nl2br(p.summary)}</p>` : ''}
  ${exp.length ? `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${primaryColor};margin-bottom:8px">Experience</div>${exp.map(e=>`<div style="margin-bottom:12px;padding-left:12px;border-left:2px solid #e2e8f0">${entryHTML(e)}</div>`).join('')}` : ''}
  ${edu.length ? `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${primaryColor};margin:14px 0 8px">Education</div>${edu.map(entryHTML).join('')}` : ''}
  ${(skills.technical?.length||skills.soft?.length) ? `
    <div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${primaryColor};margin:14px 0 8px">Skills</div>
    <div>${[...(skills.technical||[]),...(skills.soft||[])].map(s=>`<span style="background:#f1f5f9;border-radius:4px;padding:3px 10px;font-size:8.5pt;color:#475569;margin:2px;display:inline-block">${esc(s)}</span>`).join('')}</div>
  ` : ''}
  ${projects.length ? `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${primaryColor};margin:14px 0 8px">Projects</div>${projects.map(entryHTML).join('')}` : ''}
  ${certs.length ? `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${primaryColor};margin:14px 0 8px">Certifications</div>${certs.map(c=>`<div style="margin-bottom:8px"><div style="font-weight:600;font-size:9pt">${esc(c.name||'')}</div><div style="font-size:8pt;color:#64748b">${esc(c.issuer||'')}${c.year?` · ${esc(c.year)}`:''}</div></div>`).join('')}` : ''}
  ${langs.length ? `<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${primaryColor};margin:14px 0 8px">Languages</div>${langs.map(l=>`<div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:4px"><span>${esc(l.language||'')}</span><span style="color:#94a3b8">${esc(l.proficiency||'')}</span></div>`).join('')}` : ''}
  ${customSectionsHTML(custom, primaryColor)}
</div>`;
}

// ── Artisan Template ──
function renderArtisan(sections, styling) {
  const p = sections.personal || {};
  const primaryColor = styling.primaryColor || '#8b5cf6';
  const font = styling.font || 'Inter';
  const exp = sections.experience || [];
  const edu = sections.education || [];
  const skills = sections.skills || {};
  const projects = sections.projects || [];
  const certs = sections.certifications || [];
  const langs = sections.languages || [];
  const custom = sections.custom || [];

  return `
<div style="font-family:'${font}',sans-serif;font-size:10pt;color:#1a1a2e;display:flex;min-height:700px">
  <div style="width:200px;background:${primaryColor};color:white;padding:28px 20px">
    <div style="width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:24pt;margin-bottom:12px">👤</div>
    <div style="font-size:15pt;font-weight:700;line-height:1.2;margin-bottom:16px">${esc(p.fullName||'Your Name')}</div>
    <div style="font-size:8pt;opacity:0.8;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Contact</div>
    ${p.email?`<div style="font-size:8pt;opacity:0.85;margin-bottom:4px">✉ ${esc(p.email)}</div>`:''}
    ${p.phone?`<div style="font-size:8pt;opacity:0.85;margin-bottom:4px">📱 ${esc(p.phone)}</div>`:''}
    ${p.location?`<div style="font-size:8pt;opacity:0.85;margin-bottom:12px">📍 ${esc(p.location)}</div>`:''}
    ${skills.technical?.length?`
    <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin-bottom:8px;border-top:1px solid rgba(255,255,255,0.2);padding-top:12px">Skills</div>
    ${(skills.technical||[]).map(s=>`<div style="background:rgba(255,255,255,0.15);border-radius:4px;padding:2px 8px;font-size:7.5pt;margin-bottom:4px">${esc(s)}</div>`).join('')}
    `:''}
    ${langs.length?`
    <div style="font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.7;margin:12px 0 8px;border-top:1px solid rgba(255,255,255,0.2);padding-top:12px">Languages</div>
    ${langs.map(l=>`<div style="font-size:8pt;opacity:0.85;margin-bottom:3px">${esc(l.language)} · ${esc(l.proficiency)}</div>`).join('')}
    `:''}
  </div>
  <div style="flex:1;padding:28px 24px">
    ${p.summary?`<p style="font-size:9.5pt;color:#374151;line-height:1.6;margin-bottom:16px">${nl2br(p.summary)}</p>`:''}
    ${exp.length?`
      <div style="font-size:12pt;font-weight:700;color:${primaryColor};margin-bottom:10px;display:flex;align-items:center;gap:8px">Experience<span style="flex:1;height:1px;background:#e2e8f0;display:block;margin-left:8px"></span></div>
      ${exp.map(entryHTML).join('')}
    `:''}
    ${edu.length?`
      <div style="font-size:12pt;font-weight:700;color:${primaryColor};margin:14px 0 10px;display:flex;align-items:center;gap:8px">Education<span style="flex:1;height:1px;background:#e2e8f0;display:block;margin-left:8px"></span></div>
      ${edu.map(entryHTML).join('')}
    `:''}
    ${projects.length?`
      <div style="font-size:12pt;font-weight:700;color:${primaryColor};margin:14px 0 10px;display:flex;align-items:center;gap:8px">Projects<span style="flex:1;height:1px;background:#e2e8f0;display:block;margin-left:8px"></span></div>
      ${projects.map(e => `<div style="margin-bottom:10px"><div style="font-weight:600">${esc(e.name||'')} ${e.url?`<span style="font-size:8pt;color:${primaryColor}">${esc(e.url)}</span>`:''}</div>${e.technologies ? `<div style="font-size:8.5pt;color:#64748b">${esc(e.technologies)}</div>` : ''}${e.description ? `<div style="font-size:9pt;color:#374151;margin-top:3px">${nl2br(e.description)}</div>` : ''}</div>`).join('')}
    `:''}
    ${certs.length?`
      <div style="font-size:12pt;font-weight:700;color:${primaryColor};margin:14px 0 10px">Certifications</div>
      ${certs.map(c=>`<div style="margin-bottom:6px"><span style="font-weight:600">${esc(c.name)}</span> · <span style="color:#64748b;font-size:9pt">${esc(c.issuer)} ${c.year||''}</span></div>`).join('')}
    `:''}
    ${customSectionsHTML(custom, primaryColor)}
  </div>
</div>`;
}

// ── Horizon Template (clean single column) ──
function renderHorizon(sections, styling) {
  const p = sections.personal || {};
  const primaryColor = styling.primaryColor || '#10b981';
  const font = styling.font || 'Inter';
  const exp = sections.experience || [];
  const edu = sections.education || [];
  const skills = sections.skills || {};
  const projects = sections.projects || [];
  const certs = sections.certifications || [];
  const langs = sections.languages || [];
  const custom = sections.custom || [];

  return `
<div style="font-family:'${font}',sans-serif;font-size:10pt;color:#0f172a;line-height:1.5;padding:32px">
  <div style="background:linear-gradient(135deg,${primaryColor},#3b82f6);border-radius:8px;padding:24px;color:white;margin-bottom:24px">
    <div style="font-size:22pt;font-weight:700">${esc(p.fullName||'Your Name')}</div>
    <div style="margin-top:6px;opacity:0.9;font-size:8.5pt">${[p.email,p.phone,p.location].filter(Boolean).map(esc).join(' · ')}</div>
    ${p.summary?`<p style="margin-top:10px;opacity:0.9;font-size:9.5pt;line-height:1.6">${nl2br(p.summary)}</p>`:''}
  </div>
  ${(skills.technical?.length||skills.soft?.length)?`
  <div style="margin-bottom:20px">
    <div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin-bottom:8px">Skills</div>
    <div>${[...(skills.technical||[]),...(skills.soft||[])].map(s=>`<span style="background:${primaryColor}15;color:${primaryColor};border-radius:4px;padding:3px 10px;font-size:8.5pt;margin:2px;display:inline-block;border:1px solid ${primaryColor}30">${esc(s)}</span>`).join('')}</div>
  </div>`:''}
  ${exp.length?`<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin-bottom:8px">Experience</div>${exp.map(entryHTML).join('')}`:''}
  ${edu.length?`<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin:14px 0 8px">Education</div>${edu.map(entryHTML).join('')}`:''}
  ${projects.length?`<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin:14px 0 8px">Projects</div>${projects.map(e => `<div style="margin-bottom:10px"><div style="font-weight:600">${esc(e.name||'')} ${e.url?`<span style="font-size:8pt;color:${primaryColor}">${esc(e.url)}</span>`:''}</div>${e.technologies ? `<div style="font-size:8.5pt;color:#64748b">${esc(e.technologies)}</div>` : ''}${e.description ? `<div style="font-size:9pt;color:#374151;margin-top:3px">${nl2br(e.description)}</div>` : ''}</div>`).join('')}`:''}
  ${certs.length?`<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin:14px 0 8px">Certifications</div>${certs.map(c=>`<div style="margin-bottom:8px"><div style="font-weight:600;font-size:9pt">${esc(c.name||'')}</div><div style="font-size:8pt;color:#64748b">${esc(c.issuer||'')}${c.year?` · ${esc(c.year)}`:''}</div></div>`).join('')}`:''}
  ${langs.length?`<div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${primaryColor};margin:14px 0 8px">Languages</div>${langs.map(l=>`<div style="display:flex;justify-content:space-between;font-size:9pt;margin-bottom:4px"><span>${esc(l.language||'')}</span><span style="color:#94a3b8">${esc(l.proficiency||'')}</span></div>`).join('')}`:''}
  ${customSectionsHTML(custom, primaryColor)}
</div>`;
}

// ── Executive Template ──
function renderExecutive(sections, styling) {
  return renderManhattan(sections, { ...styling, primaryColor: '#1a1a2e' });
}

// ── Classic Template (ATS Optimized) ──
function renderClassic(sections, styling) {
  const p = sections.personal || {};
  const font = styling.font || 'Times New Roman';
  const exp = sections.experience || [];
  const edu = sections.education || [];
  const skills = sections.skills || {};
  const projects = sections.projects || [];
  const certs = sections.certifications || [];
  const achievements = sections.achievements || []; // if any
  const custom = sections.custom || [];

  const headerContact = [p.phone, p.email, p.linkedin, p.location].filter(Boolean).map(esc).join(' | ');

  const classicEntry = (e) => {
    if (!e) return '';
    const title = e.title || e.degree || e.name || e.language || '';
    return `
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="font-weight:700;font-size:10.5pt">${esc(title)} ${e.company ? `| ${esc(e.company)}` : ''}</div>
        <div style="font-size:10pt;font-weight:600">${esc(e.startDate||'')} ${e.startDate ? '–' : ''} ${e.current ? 'Present' : esc(e.endDate||'')}</div>
      </div>
      ${e.description ? `<ul style="margin-top:4px;padding-left:20px;font-size:10pt">
        ${esc(e.description).split('\\n').map(line => `<li style="margin-bottom:2px">${line.replace(/^•\\s*/, '')}</li>`).join('')}
      </ul>` : ''}
    </div>`;
  };

  const classicEdu = (e) => {
    if (!e) return '';
    return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div style="font-weight:700;font-size:10.5pt">${esc(e.school||'')} ${e.degree ? `, ${esc(e.degree)}` : ''}</div>
      <div style="font-size:10pt">${e.gpa ? `Score: ${esc(e.gpa)} | ` : ''}${esc(e.startDate||'')} ${e.startDate ? '–' : ''} ${e.current ? 'Present' : esc(e.endDate||'')}</div>
    </div>`;
  };

  return `
<div style="font-family:'${font}',serif;font-size:10.5pt;color:black;line-height:1.5;padding:36px">
  <div style="text-align:center;margin-bottom:12px">
    <div style="font-size:18pt;font-weight:700;margin-bottom:4px">${esc(p.fullName || 'Your Name')}</div>
    <div style="font-size:10pt">${headerContact}</div>
  </div>
  
  ${p.summary ? `<div style="margin-bottom:12px;text-align:justify">${nl2br(p.summary)}</div>` : ''}
  
  ${edu.length ? `
    <div style="font-size:11.5pt;font-weight:700;border-bottom:1px solid black;margin:12px 0 8px">Education</div>
    ${edu.map(classicEdu).join('')}
  ` : ''}
  
  ${(skills.technical?.length || skills.soft?.length) ? `
    <div style="font-size:11.5pt;font-weight:700;border-bottom:1px solid black;margin:12px 0 8px">Technical Skills</div>
    ${skills.technical?.length ? `<div style="margin-bottom:4px"><span style="font-weight:700">Technical Skills:</span> ${skills.technical.map(esc).join(', ')}</div>` : ''}
    ${skills.soft?.length ? `<div style="margin-bottom:4px"><span style="font-weight:700">Soft Skills:</span> ${skills.soft.map(esc).join(', ')}</div>` : ''}
  ` : ''}
  
  ${exp.length ? `
    <div style="font-size:11.5pt;font-weight:700;border-bottom:1px solid black;margin:12px 0 8px">Experience</div>
    ${exp.map(classicEntry).join('')}
  ` : ''}
  
  ${projects.length ? `
    <div style="font-size:11.5pt;font-weight:700;border-bottom:1px solid black;margin:12px 0 8px">Projects</div>
    ${projects.map(e => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-weight:700;font-size:10.5pt">${esc(e.name||'')} ${e.technologies ? `| ${esc(e.technologies)}` : ''}</div>
          <div style="font-size:10pt;font-weight:600">${e.url ? `(${esc(e.url)})` : ''}</div>
        </div>
        ${e.description ? `<ul style="margin-top:4px;padding-left:20px;font-size:10pt">
          ${esc(e.description).split('\\n').map(line => `<li style="margin-bottom:2px">${line.replace(/^•\\s*/, '')}</li>`).join('')}
        </ul>` : ''}
      </div>
    `).join('')}
  ` : ''}
  
  ${certs.length ? `
    <div style="font-size:11.5pt;font-weight:700;border-bottom:1px solid black;margin:12px 0 8px">Certificates</div>
    ${certs.map(c => `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <div style="font-weight:700">• ${esc(c.name)} ${c.issuer ? `– ${esc(c.issuer)}` : ''}</div>
        <div style="font-weight:600">${c.year ? `(${esc(c.year)})` : ''}</div>
      </div>
    `).join('')}
  ` : ''}

  ${custom.map(section => {
    if (!section || (!section.name && !section.description)) return '';
    return `
      <div style="font-size:11.5pt;font-weight:700;border-bottom:1px solid black;margin:12px 0 8px">${esc(section.name || 'Additional Information')}</div>
      ${section.description ? `<div style="margin-bottom:8px;white-space:pre-wrap">${esc(section.description)}</div>` : ''}
    `;
  }).join('')}
</div>`;
}
