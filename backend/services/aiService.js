/**
 * AI Service - Google Gemini Integration
 * Falls back gracefully if no API key is configured with robust, context-aware mock handlers
 */

let genAI = null;
let model = null;

// Initialize Gemini if API key exists and is valid
let useMockAI = false;
if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_')) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('🤖 Gemini AI initialized');
  } catch (err) {
    console.warn('⚠️  Gemini AI initialization failed:', err.message);
    useMockAI = true;
  }
} else {
  useMockAI = true;
  console.log('🤖 Using Mock AI (No valid API key found)');
}

/**
 * Helper: Call Gemini with a prompt
 */
async function callGemini(prompt) {
  if (!model) {
    throw new Error('AI service not configured. Please add GEMINI_API_KEY to .env');
  }
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9#+%\-/.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRoleProfile(jobDescription = '', sections = {}) {
  const summary = sections?.personal?.summary || '';
  const firstTitle = sections?.experience?.[0]?.title || '';
  const context = normalizeText([jobDescription, summary, firstTitle].filter(Boolean).join(' '));

  const profiles = [
    {
      industry: 'Technology',
      match: ['software', 'developer', 'engineer', 'frontend', 'backend', 'full stack', 'web', 'mobile', 'devops', 'cloud', 'api'],
      keywords: ['javascript', 'typescript', 'react', 'node', 'python', 'sql', 'rest api', 'docker', 'aws', 'testing', 'system design', 'git']
    },
    {
      industry: 'Data & Analytics',
      match: ['data', 'analyst', 'analytics', 'scientist', 'machine learning', 'ml', 'bi', 'business intelligence', 'insights'],
      keywords: ['python', 'sql', 'tableau', 'power bi', 'excel', 'statistics', 'pandas', 'numpy', 'machine learning', 'data visualization', 'forecasting']
    },
    {
      industry: 'Product & Operations',
      match: ['product', 'project', 'operations', 'program manager', 'scrum', 'agile', 'delivery', 'ops'],
      keywords: ['roadmap', 'stakeholder', 'agile', 'scrum', 'jira', 'planning', 'process improvement', 'risk management', 'cross-functional', 'leadership']
    },
    {
      industry: 'Sales & Marketing',
      match: ['sales', 'marketing', 'growth', 'brand', 'content', 'seo', 'crm', 'business development'],
      keywords: ['lead generation', 'crm', 'pipeline', 'seo', 'campaign', 'conversion', 'content', 'analytics', 'negotiation', 'social media']
    },
    {
      industry: 'Design & Creative',
      match: ['designer', 'design', 'ux', 'ui', 'creative', 'visual', 'brand'],
      keywords: ['figma', 'ux research', 'wireframing', 'prototyping', 'design systems', 'user testing', 'adobe', 'visual design', 'html', 'css']
    }
  ];

  const profile = profiles.find(item => item.match.some(term => context.includes(term))) || {
    industry: 'General Professional',
    keywords: ['communication', 'leadership', 'collaboration', 'analysis', 'problem solving', 'project management', 'strategy', 'optimization']
  };

  if (profile.industry === 'Technology') {
    if (context.includes('cloud') || context.includes('aws') || context.includes('azure') || context.includes('gcp') || context.includes('devops') || context.includes('kubernetes') || context.includes('terraform')) {
      profile.keywords = ['aws', 'cloud', 'kubernetes', 'terraform', 'docker', 'ci/cd', 'microservices', 'rest api', 'system design', 'testing'];
    } else if (context.includes('frontend') || context.includes('ui') || context.includes('ux') || context.includes('react') || context.includes('angular') || context.includes('vue') || context.includes('html') || context.includes('css')) {
      profile.keywords = ['react', 'javascript', 'typescript', 'html', 'css', 'responsive design', 'accessibility', 'testing', 'rest api', 'git'];
    } else if (context.includes('backend') || context.includes('api') || context.includes('node') || context.includes('java') || context.includes('python') || context.includes('sql')) {
      profile.keywords = ['node.js', 'api', 'rest api', 'sql', 'microservices', 'testing', 'system design', 'docker', 'aws', 'git'];
    }
  }

  const contextKeywordBank = [
    'aws', 'azure', 'gcp', 'cloud', 'kubernetes', 'terraform', 'docker', 'microservices',
    'react', 'node', 'typescript', 'javascript', 'python', 'java', 'sql', 'api', 'rest api',
    'etl', 'data pipeline', 'machine learning', 'tableau', 'power bi', 'figma', 'ux', 'ui',
    'scrum', 'agile', 'jira', 'leadership', 'stakeholder', 'budget', 'roadmap', 'analytics'
  ];
  const contextKeywords = contextKeywordBank.filter(term => context.includes(term));

  return { ...profile, context, keywords: [...new Set([...profile.keywords, ...contextKeywords])] };
}

function getUniqueHits(text, keywords) {
  const normalized = normalizeText(text);
  const found = [];
  const missing = [];

  keywords.forEach(keyword => {
    const token = normalizeText(keyword);
    if (!token) return;
    if (normalized.includes(token)) found.push(keyword);
    else missing.push(keyword);
  });

  return { found, missing };
}

function countMetricSignals(text) {
  const normalized = String(text || '');
  const matches = normalized.match(/(\b\d+[\d,]*(?:\.\d+)?%\b|\$\d[\d,]*(?:\.\d+)?\b|\b\d+[xX]?\b)/g);
  return matches ? matches.length : 0;
}

function countBulletSignals(entries = []) {
  return entries.reduce((count, entry) => {
    const description = String(entry?.description || '');
    if (!description) return count;
    const lines = description.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const bullets = lines.filter(line => /^[•\-*]/.test(line)).length;
    return count + Math.max(bullets, lines.length > 1 ? lines.length : 1);
  }, 0);
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch(e) {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) { try { return JSON.parse(match[1]); } catch(e2) {} }
  const firstBrace = text.indexOf('{'), firstBracket = text.indexOf('[');
  const startObj = firstBrace !== -1 ? firstBrace : Infinity;
  const startArr = firstBracket !== -1 ? firstBracket : Infinity;
  if (startObj < startArr && startObj !== Infinity) {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > startObj) { try { return JSON.parse(text.substring(startObj, lastBrace + 1)); } catch(e3) {} }
  } else if (startArr < startObj && startArr !== Infinity) {
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > startArr) { try { return JSON.parse(text.substring(startArr, lastBracket + 1)); } catch(e3) {} }
  }
  return null;
}

/**
 * Generate professional resume summary
 */
async function generateSummary(sections, jobTitle) {
  if (useMockAI || !model) {
    // ... existing mock ...
    const exp = sections?.experience || [];
    const skills = sections?.skills?.technical || [];
    const title = jobTitle || (exp[0]?.title) || 'Professional';
    return { summary: `Results-oriented ${title} with proven expertise in ${skills.slice(0,2).join(', ')}. Experienced in delivering high-impact solutions.` };
  }

  const personal = sections?.personal || {};
  const experience = sections?.experience || [];
  const skills = sections?.skills?.technical || [];

  const prompt = `
You are an expert resume writer. Write a compelling, ATS-friendly professional resume summary (3-4 sentences max).
Target Role: ${jobTitle || 'Professional'}

Name: ${personal.fullName || 'Candidate'}
Key Skills: ${skills.slice(0, 10).join(', ')}
Recent Experience:
${experience.slice(0, 3).map(e => `- ${e.title} at ${e.company} (${e.startDate} - ${e.endDate || 'Present'}): ${e.description || ''}`).join('\n')}

Guidelines:
- Start strong with the professional title
- Highlight quantified achievements and top skills
- Keep it under 80 words
- Do NOT use "I" or first person pronouns
- Output ONLY the summary paragraph.
`;
  try {
    const text = await callGemini(prompt);
    return { summary: text.trim() };
  } catch (err) {
    return { summary: '', error: err.message };
  }
}

/**
 * Suggest relevant skills
 */
async function suggestSkills(jobTitle, experience, existingSkills = []) {
  if (useMockAI || !model) {
    return { skills: ["JavaScript", "React", "Node.js", "Project Management", "Agile"].filter(s => !existingSkills.includes(s)) };
  }

  const prompt = `
You are an expert technical recruiter. Suggest exactly 12 highly in-demand technical and hard skills for this candidate profile.
Target Role: ${jobTitle || 'Professional'}
Background: ${(experience || []).slice(0, 3).map(e => `${e.title} at ${e.company}`).join(', ')}
Already listed skills (DO NOT INCLUDE THESE): ${existingSkills.join(', ')}

Return ONLY a valid JSON array of strings. Example: ["Python", "AWS", "SQL"]
`;
  try {
    const text = await callGemini(prompt);
    const parsed = extractJSON(text);
    if (Array.isArray(parsed)) {
      return { skills: parsed.filter(s => !existingSkills.includes(s)).slice(0, 12) };
    }
    return { skills: [] };
  } catch (err) {
    return { skills: [], error: err.message };
  }
}

/**
 * Analyze ATS score
 */
async function analyzeATSScore(sections, jobDescription = '') {
  if (useMockAI || !model) {
    // Quick fallback mock
    return { score: 75, industry: 'General', strengths: ['Valid format'], improvements: ['Add more metrics'], keywords_found: ['Teamwork'], keywords_missing: ['Leadership'] };
  }

  const personal = sections?.personal || {};
  const experience = sections?.experience || [];
  const skills = [...(sections?.skills?.technical || []), ...(sections?.skills?.soft || [])];
  const roleProfile = buildRoleProfile(jobDescription, sections);

  const resumeText = `
Summary: ${personal.summary}
Skills: ${skills.join(', ')}
Experience: ${experience.map(e => `${e.title} at ${e.company}: ${e.description}`).join('\n')}
  `.trim();

  const prompt = `
You are an advanced Applicant Tracking System (ATS) analyzer. Score the following resume against the target role/industry: "${roleProfile.industry}".
Job Description Context: ${jobDescription || 'N/A'}

Resume Data:
${resumeText}

Analyze it strictly based on:
1. Keyword match density for the target role
2. Action verbs and measurable metrics (numbers, %, $)
3. Structure completeness

Output ONLY valid JSON matching this schema exactly:
{
  "score": <integer between 0 and 100>,
  "industry": "${roleProfile.industry}",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>", "<improvement 4>"],
  "keywords_found": ["<kw1>", "<kw2>", "<kw3>", "<kw4>", "<kw5>"],
  "keywords_missing": ["<kw1>", "<kw2>", "<kw3>", "<kw4>", "<kw5>"]
}
`;
  try {
    const text = await callGemini(prompt);
    const parsed = extractJSON(text);
    if (parsed && typeof parsed.score !== 'undefined') return parsed;
    return { score: 0, feedback: [] };
  } catch (err) {
    return { score: 0, feedback: [], error: err.message };
  }
}

/**
 * Rewrite content to be more impactful
 */
async function rewriteContent(content, context = '', tone = 'Professional') {
  if (useMockAI || !model) {
    return { rewritten: `Successfully led initiatives resulting in increased performance. (Mock rewritten for: ${content.substring(0,20)}...)` };
  }

  const prompt = `
You are an expert resume copywriter. Rewrite the following resume bullet point/content to be more impactful, ATS-friendly, and results-oriented.
Target Tone: ${tone} (Ensure the rewrite matches this tone perfectly).
Context: ${context}

Original Text:
"${content}"

Guidelines:
- Start with a strong action verb
- Emphasize quantifiable metrics or impact
- Make it highly professional and concise
- Output ONLY the rewritten text, without any quotes or explanations.
`;
  try {
    const text = await callGemini(prompt);
    return { rewritten: text.replace(/^"|"$/g, '').trim() };
  } catch (err) {
    return { rewritten: content, error: err.message };
  }
}

/**
 * Full resume optimization
 */
async function optimizeResume(sections) {
  if (useMockAI || !model) {
    return { suggestions: [{ section: "overall", priority: "medium", suggestion: "Consider adding more quantifiable metrics." }] };
  }

  const experience = sections?.experience || [];
  const skills = sections?.skills?.technical || [];

  const prompt = `
You are a senior career coach reviewing a resume. Provide 4-6 highly specific, actionable optimization suggestions.

Resume Snapshot:
- Experience entries: ${experience.length}
- Skills listed: ${skills.length}
- Summary length: ${(sections?.personal?.summary || '').length} characters
- Recent role descriptions: ${experience.slice(0,2).map(e => e.description).join(' | ')}

Focus on:
- Vague bullet points that lack metrics
- Missing critical sections
- Weak action verbs

Output ONLY valid JSON matching this schema:
[
  {
    "section": "summary|experience|skills|education|overall",
    "priority": "high|medium|low",
    "suggestion": "<specific actionable advice>"
  }
]
`;
  try {
    const text = await callGemini(prompt);
    const parsed = extractJSON(text);
    if (Array.isArray(parsed)) return { suggestions: parsed };
    return { suggestions: [] };
  } catch (err) {
    return { suggestions: [], error: err.message };
  }
}

module.exports = {
  generateSummary,
  suggestSkills,
  analyzeATSScore,
  rewriteContent,
  optimizeResume
};
