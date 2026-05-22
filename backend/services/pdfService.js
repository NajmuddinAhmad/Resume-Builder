/**
 * PDF Generation Service using Puppeteer
 * Renders the resume HTML template and converts to PDF
 */

let puppeteer = null;
let chromium = null;
try {
  if (process.env.NODE_ENV === 'production') {
    puppeteer = require('puppeteer-core');
    chromium = require('@sparticuz/chromium');
  } else {
    puppeteer = require('puppeteer');
  }
} catch (err) {
  console.warn('⚠️  Puppeteer not available. PDF export will be disabled.');
}

const { Document, Packer, Paragraph, ImageRun } = require('docx');

const DOCX_VIEWPORT_WIDTH = 794;
const DOCX_VIEWPORT_HEIGHT = 1123;
const A4_PAGE_WIDTH = 11906;
const A4_PAGE_HEIGHT = 16838;

/**
 * Build full HTML document for a resume
 */
function buildResumeHTML(resume) {
  const { sections = {}, styling = {}, template_id = 'manhattan' } = resume;
  const personal = sections.personal || {};
  const experience = sections.experience || [];
  const education = sections.education || [];
  const skills = sections.skills || { technical: [], soft: [] };
  const projects = sections.projects || [];
  const certifications = sections.certifications || [];
  const languages = sections.languages || [];

  const primaryColor = styling.primaryColor || '#6366f1';
  const font = styling.font || 'Inter';

  const templates = {
    manhattan: buildManhattanTemplate,
    silicon: buildSiliconTemplate,
    artisan: buildArtisanTemplate,
    horizon: buildHorizonTemplate,
    executive: buildExecutiveTemplate
  };

  const builder = templates[template_id] || buildManhattanTemplate;
  return builder({ personal, experience, education, skills, projects, certifications, languages, primaryColor, font });
}

function buildDocxHTML(resume) {
  const { sections = {}, styling = {}, template_id = 'manhattan' } = resume;
  const personal = sections.personal || {};
  const experience = sections.experience || [];
  const education = sections.education || [];
  const skills = sections.skills || { technical: [], soft: [] };
  const projects = sections.projects || [];
  const certifications = sections.certifications || [];
  const languages = sections.languages || [];

  const primaryColor = styling.primaryColor || '#6366f1';
  const accentColor = styling.accentColor || '#8b5cf6';
  const font = styling.font || 'Inter';

  const templatePalette = {
    manhattan: { header: primaryColor, sidebar: '#f8fafc', section: primaryColor },
    silicon: { header: '#0f172a', sidebar: '#ffffff', section: primaryColor },
    artisan: { header: primaryColor, sidebar: primaryColor, section: 'white' },
    horizon: { header: primaryColor, sidebar: '#ffffff', section: primaryColor },
    executive: { header: '#1a1a2e', sidebar: '#f8fafc', section: '#1a1a2e' }
  };

  const palette = templatePalette[template_id] || templatePalette.manhattan;

  const esc = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const nl2br = (value) => esc(value).replace(/\n/g, '<br>');

  const sectionTitle = (label, color) => `
    <tr>
      <td style="padding:14px 0 8px 0;">
        <div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${color};border-bottom:2px solid ${color};padding-bottom:4px;">${label}</div>
      </td>
    </tr>`;

  const entryBlock = (item, type = 'experience') => {
    if (!item) return '';
    const title = esc(item.title || item.degree || item.name || item.language || '');
    const org = esc(item.company || item.school || '');
    const location = item.location ? ` &bull; ${esc(item.location)}` : '';
    const date = `${esc(item.startDate || '')}${item.startDate ? ' &ndash; ' : ''}${item.current ? 'Present' : esc(item.endDate || '')}`;
    const description = item.description ? `<div style="font-size:9pt;color:#374151;line-height:1.65;margin-top:4px;">${nl2br(item.description)}</div>` : '';
    const extraField = item.field ? `<div style="font-size:9pt;color:#64748b;margin-top:2px;">${esc(item.field)}</div>` : '';
    const gpa = item.gpa ? `<div style="font-size:9pt;color:#64748b;margin-top:2px;">GPA: ${esc(item.gpa)}</div>` : '';
    const technologies = item.technologies ? `<div style="font-size:8.5pt;color:${primaryColor};margin-top:2px;">${esc(item.technologies)}</div>` : '';

    return `
      <tr>
        <td style="padding:0 0 10px 0;">
          <div style="font-weight:600;font-size:10pt;color:#1a1a2e;">${title}</div>
          <div style="font-size:9pt;color:#64748b;line-height:1.5;">${org}${location}</div>
          <div style="font-size:9pt;color:#94a3b8;white-space:nowrap;">${date}</div>
          ${description}${extraField}${gpa}${technologies}
        </td>
      </tr>`;
  };

  const skillPill = (value, color, background, border) => `
    <span style="display:inline-block;margin:2px 4px 2px 0;padding:4px 10px;border-radius:4px;border:1px solid ${border};background:${background};color:${color};font-size:8.5pt;line-height:1.4;">${esc(value)}</span>`;

  const skillsHTML = [
    ...(skills.technical || []).map(skill => skillPill(skill, primaryColor, `${primaryColor}18`, `${primaryColor}30`)),
    ...(skills.soft || []).map(skill => skillPill(skill, '#475569', '#f1f5f9', '#e2e8f0'))
  ].join('');

  const contactLine = [personal.email, personal.phone, personal.location, personal.linkedin, personal.website]
    .filter(Boolean)
    .map(esc)
    .join(' &bull; ');

  const leftColumn = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${personal.summary ? sectionTitle('Professional Summary', palette.section) + `
        <tr><td style="padding:0 0 8px 0;font-size:9.5pt;line-height:1.7;color:#374151;">${nl2br(personal.summary)}</td></tr>
      ` : ''}
      ${experience.length ? sectionTitle('Experience', palette.section) + experience.map(item => entryBlock(item, 'experience')).join('') : ''}
      ${education.length ? sectionTitle('Education', palette.section) + education.map(item => entryBlock(item, 'education')).join('') : ''}
      ${projects.length ? sectionTitle('Projects', palette.section) + projects.map(item => entryBlock(item, 'project')).join('') : ''}
    </table>`;

  const rightColumn = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${skillsHTML ? `
        <tr><td style="padding:0 0 8px 0;">
          <div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${palette.section};border-bottom:2px solid ${palette.section};padding-bottom:4px;">Skills</div>
        </td></tr>
        <tr><td style="padding:0 0 10px 0;">${skillsHTML}</td></tr>
      ` : ''}
      ${certifications.length ? sectionTitle('Certifications', palette.section) + certifications.map(item => `
        <tr><td style="padding:0 0 8px 0;">
          <div style="font-weight:600;font-size:9pt;color:#1a1a2e;">${esc(item.name || '')}</div>
          <div style="font-size:8.5pt;color:#64748b;">${esc(item.issuer || '')}${item.year ? ` &bull; ${esc(item.year)}` : ''}</div>
        </td></tr>
      `).join('') : ''}
      ${languages.length ? sectionTitle('Languages', palette.section) + languages.map(item => `
        <tr><td style="padding:0 0 6px 0;">
          <div style="font-size:9pt;color:#1a1a2e;display:flex;justify-content:space-between;">
            <span>${esc(item.language || '')}</span>
            <span style="color:#94a3b8;">${esc(item.proficiency || '')}</span>
          </div>
        </td></tr>
      `).join('') : ''}
    </table>`;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { margin: 0.55in; }
      body { margin: 0; padding: 0; font-family: '${font}', Arial, sans-serif; color: #1a1a2e; }
      table { border-collapse: collapse; }
      .header-title { font-size: 24pt; font-weight: 700; letter-spacing: -0.5px; line-height: 1.1; }
      .header-contact { margin-top: 6px; font-size: 8.75pt; opacity: 0.92; line-height: 1.5; }
      .page-shell { width: 100%; }
      .sidebar-cell { background: ${palette.sidebar}; border-left: 1px solid #e2e8f0; vertical-align: top; }
      .main-cell { vertical-align: top; }
    </style>
  </head>
  <body>
    <table class="page-shell" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${palette.header};color:white;padding:26px 28px 22px 28px;">
          <div class="header-title">${esc(personal.fullName || 'Your Name')}</div>
          <div class="header-contact">${contactLine || '&nbsp;'}</div>
        </td>
      </tr>
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td class="main-cell" width="70%" style="padding:22px 24px 22px 28px;">
                ${leftColumn}
              </td>
              <td class="sidebar-cell" width="30%" style="padding:22px 18px 22px 18px;">
                ${rightColumn}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function buildManhattanTemplate({ personal, experience, education, skills, projects, certifications, languages, primaryColor, font }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${font}', sans-serif; font-size: 10pt; color: #1a1a2e; line-height: 1.5; }
  .header { background: ${primaryColor}; color: white; padding: 28px 32px; }
  .name { font-size: 26pt; font-weight: 700; letter-spacing: -0.5px; }
  .contact { margin-top: 8px; font-size: 9pt; opacity: 0.9; display: flex; gap: 16px; flex-wrap: wrap; }
  .body { display: flex; }
  .main { flex: 1; padding: 24px 32px; }
  .sidebar { width: 220px; background: #f8fafc; padding: 24px 20px; border-left: 1px solid #e2e8f0; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; 
                   color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; padding-bottom: 4px; margin-bottom: 12px; }
  .entry { margin-bottom: 14px; }
  .entry-header { display: flex; justify-content: space-between; align-items: flex-start; }
  .entry-title { font-weight: 600; font-size: 10.5pt; }
  .entry-sub { color: #64748b; font-size: 9pt; }
  .entry-date { font-size: 9pt; color: #64748b; white-space: nowrap; }
  .entry-desc { margin-top: 4px; font-size: 9pt; color: #374151; }
  .skill-tag { display: inline-block; background: ${primaryColor}18; color: ${primaryColor}; 
               border: 1px solid ${primaryColor}30; border-radius: 4px; padding: 2px 8px; 
               font-size: 8.5pt; margin: 2px; }
  .summary { font-size: 9.5pt; color: #374151; line-height: 1.6; }
  .sidebar .section-title { font-size: 9pt; }
  .lang-item { display: flex; justify-content: space-between; font-size: 9pt; margin-bottom: 6px; }
</style>
</head>
<body>
<div class="header">
  <div class="name">${personal.fullName || 'Your Name'}</div>
  <div class="contact">
    ${personal.email ? `<span>📧 ${personal.email}</span>` : ''}
    ${personal.phone ? `<span>📱 ${personal.phone}</span>` : ''}
    ${personal.location ? `<span>📍 ${personal.location}</span>` : ''}
    ${personal.linkedin ? `<span>🔗 ${personal.linkedin}</span>` : ''}
    ${personal.website ? `<span>🌐 ${personal.website}</span>` : ''}
  </div>
</div>
<div class="body">
  <div class="main">
    ${personal.summary ? `
    <div class="section">
      <div class="section-title">Professional Summary</div>
      <p class="summary">${personal.summary}</p>
    </div>` : ''}
    ${experience.length ? `
    <div class="section">
      <div class="section-title">Experience</div>
      ${experience.map(e => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <div class="entry-title">${e.title || ''}</div>
            <div class="entry-sub">${e.company || ''}${e.location ? ` · ${e.location}` : ''}</div>
          </div>
          <div class="entry-date">${e.startDate || ''} – ${e.current ? 'Present' : (e.endDate || '')}</div>
        </div>
        ${e.description ? `<div class="entry-desc">${e.description.replace(/\n/g, '<br>')}</div>` : ''}
      </div>`).join('')}
    </div>` : ''}
    ${education.length ? `
    <div class="section">
      <div class="section-title">Education</div>
      ${education.map(e => `
      <div class="entry">
        <div class="entry-header">
          <div>
            <div class="entry-title">${e.degree || ''}</div>
            <div class="entry-sub">${e.school || ''}${e.field ? ` · ${e.field}` : ''}</div>
          </div>
          <div class="entry-date">${e.startDate || ''} – ${e.endDate || ''}</div>
        </div>
        ${e.gpa ? `<div class="entry-desc">GPA: ${e.gpa}</div>` : ''}
      </div>`).join('')}
    </div>` : ''}
    ${projects.length ? `
    <div class="section">
      <div class="section-title">Projects</div>
      ${projects.map(p => `
      <div class="entry">
        <div class="entry-title">${p.name || ''} ${p.url ? `<span style="font-size:8pt;color:#64748b">| ${p.url}</span>` : ''}</div>
        ${p.technologies ? `<div class="entry-sub">${p.technologies}</div>` : ''}
        ${p.description ? `<div class="entry-desc">${p.description}</div>` : ''}
      </div>`).join('')}
    </div>` : ''}
  </div>
  <div class="sidebar">
    ${skills.technical?.length ? `
    <div class="section">
      <div class="section-title">Skills</div>
      <div>${(skills.technical || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>
    </div>` : ''}
    ${skills.soft?.length ? `
    <div class="section">
      <div class="section-title">Soft Skills</div>
      <div>${(skills.soft || []).map(s => `<span class="skill-tag">${s}</span>`).join('')}</div>
    </div>` : ''}
    ${certifications.length ? `
    <div class="section">
      <div class="section-title">Certifications</div>
      ${certifications.map(c => `
      <div class="entry" style="margin-bottom:8px;">
        <div style="font-weight:600;font-size:9pt;">${c.name || ''}</div>
        <div class="entry-sub">${c.issuer || ''} ${c.year ? `· ${c.year}` : ''}</div>
      </div>`).join('')}
    </div>` : ''}
    ${languages.length ? `
    <div class="section">
      <div class="section-title">Languages</div>
      ${languages.map(l => `
      <div class="lang-item">
        <span>${l.language || ''}</span>
        <span style="color:#94a3b8;">${l.proficiency || ''}</span>
      </div>`).join('')}
    </div>` : ''}
  </div>
</div>
</body>
</html>`;
}

function buildSiliconTemplate({ personal, experience, education, skills, projects, certifications, languages, primaryColor, font }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${font}', sans-serif; font-size: 10pt; color: #0f172a; line-height: 1.6; padding: 40px; }
  .name { font-size: 28pt; font-weight: 700; color: #0f172a; }
  .contact { color: #64748b; font-size: 9pt; margin-top: 4px; display: flex; gap: 16px; flex-wrap: wrap; }
  .divider { border: none; border-top: 2px solid ${primaryColor}; margin: 20px 0; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${primaryColor}; margin-bottom: 10px; }
  .entry { margin-bottom: 12px; padding-left: 12px; border-left: 2px solid #e2e8f0; }
  .entry:hover { border-left-color: ${primaryColor}; }
  .entry-header { display: flex; justify-content: space-between; }
  .entry-title { font-weight: 600; }
  .entry-sub { color: #64748b; font-size: 9pt; }
  .entry-date { font-size: 9pt; color: #94a3b8; }
  .entry-desc { font-size: 9pt; margin-top: 4px; color: #374151; }
  .skills-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill { background: #f1f5f9; border-radius: 4px; padding: 3px 10px; font-size: 8.5pt; color: #475569; }
</style>
</head>
<body>
  <div class="name">${personal.fullName || 'Your Name'}</div>
  <div class="contact">
    ${[personal.email, personal.phone, personal.location, personal.linkedin, personal.website].filter(Boolean).join(' · ')}
  </div>
  <hr class="divider">
  ${personal.summary ? `<div class="section"><div class="section-title">Summary</div><p style="font-size:9.5pt;color:#374151;">${personal.summary}</p></div>` : ''}
  ${experience.length ? `<div class="section"><div class="section-title">Experience</div>${experience.map(e => `
  <div class="entry">
    <div class="entry-header">
      <div><div class="entry-title">${e.title}</div><div class="entry-sub">${e.company}${e.location ? ` · ${e.location}` : ''}</div></div>
      <div class="entry-date">${e.startDate} – ${e.current ? 'Present' : e.endDate}</div>
    </div>
    ${e.description ? `<div class="entry-desc">${e.description.replace(/\n/g,'<br>')}</div>` : ''}
  </div>`).join('')}</div>` : ''}
  ${education.length ? `<div class="section"><div class="section-title">Education</div>${education.map(e => `
  <div class="entry">
    <div class="entry-header">
      <div><div class="entry-title">${e.degree}</div><div class="entry-sub">${e.school}</div></div>
      <div class="entry-date">${e.startDate} – ${e.endDate}</div>
    </div>
  </div>`).join('')}</div>` : ''}
  ${(skills.technical?.length || skills.soft?.length) ? `
  <div class="section"><div class="section-title">Skills</div>
    <div class="skills-grid">${[...(skills.technical||[]),...(skills.soft||[])].map(s=>`<span class="skill">${s}</span>`).join('')}</div>
  </div>` : ''}
  ${projects.length ? `<div class="section"><div class="section-title">Projects</div>${projects.map(p=>`
  <div class="entry">
    <div class="entry-title">${p.name} ${p.url?`<span style="font-size:8pt;color:#6366f1">${p.url}</span>`:''}</div>
    ${p.technologies?`<div class="entry-sub">${p.technologies}</div>`:''}
    ${p.description?`<div class="entry-desc">${p.description}</div>`:''}
  </div>`).join('')}</div>` : ''}
  ${certifications.length ? `<div class="section"><div class="section-title">Certifications</div>${certifications.map(c=>`
  <div style="margin-bottom:8px;"><span style="font-weight:600;">${c.name}</span> <span style="color:#94a3b8;font-size:9pt;">· ${c.issuer} ${c.year||''}</span></div>`).join('')}</div>` : ''}
</body>
</html>`;
}

function buildArtisanTemplate({ personal, experience, education, skills, projects, certifications, languages, primaryColor, font }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=${font.replace(' ', '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${font}', sans-serif; font-size: 10pt; color: #1a1a2e; display: flex; min-height: 100vh; }
  .sidebar { width: 240px; background: ${primaryColor}; color: white; padding: 32px 24px; }
  .avatar-placeholder { width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.2); 
                         display: flex; align-items: center; justify-content: center; font-size: 28pt; margin-bottom: 16px; }
  .name { font-size: 18pt; font-weight: 700; line-height: 1.2; }
  .sidebar .section { margin-top: 24px; }
  .sidebar .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; 
                              opacity: 0.7; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; }
  .contact-item { font-size: 8.5pt; opacity: 0.9; margin-bottom: 6px; }
  .skill-bar { margin-bottom: 8px; }
  .skill-name { font-size: 8.5pt; opacity: 0.9; margin-bottom: 3px; }
  .skill-track { background: rgba(255,255,255,0.2); border-radius: 4px; height: 4px; }
  .skill-fill { background: white; border-radius: 4px; height: 4px; width: 80%; }
  .main { flex: 1; padding: 32px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 12pt; font-weight: 700; color: ${primaryColor}; margin-bottom: 12px; 
                   display: flex; align-items: center; gap: 8px; }
  .section-title::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
  .entry { margin-bottom: 14px; }
  .entry-title { font-weight: 600; font-size: 10.5pt; }
  .entry-sub { color: #64748b; font-size: 9pt; }
  .entry-date { font-size: 9pt; color: #94a3b8; }
  .entry-desc { font-size: 9pt; color: #374151; margin-top: 4px; }
  .skill-tag { display: inline-block; background: ${primaryColor}15; color: ${primaryColor}; 
               border-radius: 4px; padding: 2px 8px; font-size: 8.5pt; margin: 2px; }
</style>
</head>
<body>
<div class="sidebar">
  <div class="avatar-placeholder">👤</div>
  <div class="name">${personal.fullName || 'Your Name'}</div>
  <div class="section">
    <div class="section-title">Contact</div>
    ${personal.email ? `<div class="contact-item">📧 ${personal.email}</div>` : ''}
    ${personal.phone ? `<div class="contact-item">📱 ${personal.phone}</div>` : ''}
    ${personal.location ? `<div class="contact-item">📍 ${personal.location}</div>` : ''}
    ${personal.linkedin ? `<div class="contact-item">🔗 ${personal.linkedin}</div>` : ''}
    ${personal.website ? `<div class="contact-item">🌐 ${personal.website}</div>` : ''}
  </div>
  ${skills.technical?.length ? `
  <div class="section">
    <div class="section-title">Skills</div>
    ${(skills.technical||[]).map(s=>`<div class="skill-bar"><div class="skill-name">${s}</div><div class="skill-track"><div class="skill-fill"></div></div></div>`).join('')}
  </div>` : ''}
  ${languages.length ? `
  <div class="section">
    <div class="section-title">Languages</div>
    ${languages.map(l=>`<div class="contact-item">${l.language} · <span style="opacity:0.7">${l.proficiency}</span></div>`).join('')}
  </div>` : ''}
</div>
<div class="main">
  ${personal.summary ? `<div class="section"><div class="section-title">About Me</div><p style="font-size:9.5pt;color:#374151;line-height:1.6">${personal.summary}</p></div>` : ''}
  ${experience.length ? `
  <div class="section"><div class="section-title">Experience</div>
  ${experience.map(e=>`<div class="entry">
    <div style="display:flex;justify-content:space-between">
      <div><div class="entry-title">${e.title}</div><div class="entry-sub">${e.company}</div></div>
      <div class="entry-date">${e.startDate} – ${e.current?'Present':e.endDate}</div>
    </div>
    ${e.description?`<div class="entry-desc">${e.description.replace(/\n/g,'<br>')}</div>`:''}
  </div>`).join('')}</div>` : ''}
  ${education.length ? `
  <div class="section"><div class="section-title">Education</div>
  ${education.map(e=>`<div class="entry">
    <div style="display:flex;justify-content:space-between">
      <div><div class="entry-title">${e.degree}</div><div class="entry-sub">${e.school}</div></div>
      <div class="entry-date">${e.startDate} – ${e.endDate}</div>
    </div>
  </div>`).join('')}</div>` : ''}
  ${projects.length ? `
  <div class="section"><div class="section-title">Projects</div>
  ${projects.map(p=>`<div class="entry">
    <div class="entry-title">${p.name}</div>
    ${p.technologies?`<div class="entry-sub">${p.technologies}</div>`:''}
    ${p.description?`<div class="entry-desc">${p.description}</div>`:''}
  </div>`).join('')}</div>` : ''}
  ${certifications.length ? `
  <div class="section"><div class="section-title">Certifications</div>
  ${certifications.map(c=>`<div class="entry" style="margin-bottom:8px">
    <div class="entry-title">${c.name}</div>
    <div class="entry-sub">${c.issuer} ${c.year?`· ${c.year}`:''}</div>
  </div>`).join('')}</div>` : ''}
</div>
</body>
</html>`;
}

function buildHorizonTemplate(data) {
  // Minimal clean template
  return buildSiliconTemplate(data);
}

function buildExecutiveTemplate(data) {
  return buildManhattanTemplate(data);
}

/**
 * Generate PDF from resume data
 */
async function generatePDF(resume) {
  if (!puppeteer) {
    throw new Error('Puppeteer not available. Install it with: npm install puppeteer');
  }

  const html = buildResumeHTML(resume);

  let browser;
  if (chromium) {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  } else {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

async function generateDOCX(resume) {
  if (!puppeteer) {
    throw new Error('Puppeteer not available. Install it with: npm install puppeteer');
  }

  const html = buildResumeHTML(resume);
  let browser;
  if (chromium) {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  } else {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: DOCX_VIEWPORT_WIDTH,
      height: DOCX_VIEWPORT_HEIGHT,
      deviceScaleFactor: 1
    });

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const totalHeight = await page.evaluate(() => Math.ceil(Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    )));

    const pageImages = [];
    for (let y = 0; y < totalHeight; y += DOCX_VIEWPORT_HEIGHT) {
      const height = Math.min(DOCX_VIEWPORT_HEIGHT, totalHeight - y);
      const data = await page.screenshot({
        type: 'png',
        clip: {
          x: 0,
          y,
          width: DOCX_VIEWPORT_WIDTH,
          height
        }
      });
      pageImages.push({ data, height });
    }

    if (pageImages.length === 0) {
      const data = await page.screenshot({ type: 'png', fullPage: true });
      pageImages.push({ data, height: DOCX_VIEWPORT_HEIGHT });
    }

    const doc = new Document({
      sections: pageImages.map((pageImage) => ({
        properties: {
          page: {
            size: {
              width: A4_PAGE_WIDTH,
              height: A4_PAGE_HEIGHT
            },
            margin: {
              top: 0,
              right: 0,
              bottom: 0,
              left: 0
            }
          }
        },
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                data: pageImage.data,
                transformation: {
                  width: DOCX_VIEWPORT_WIDTH,
                  height: pageImage.height
                }
              })
            ]
          })
        ]
      }))
    });

    return await Packer.toBuffer(doc);
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF, buildResumeHTML, buildDocxHTML };
