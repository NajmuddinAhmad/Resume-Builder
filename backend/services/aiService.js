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

/**
 * Generate professional resume summary
 */
async function generateSummary(sections, jobTitle) {
  if (useMockAI || !model) {
    const personal = sections?.personal || {};
    const exp = sections?.experience || [];
    const skills = sections?.skills?.technical || [];
    
    const title = jobTitle || (exp[0]?.title) || 'Professional';
    const company = exp[0]?.company ? ` at ${exp[0].company}` : '';
    const skillText = skills.length > 0 ? `, specializing in ${skills.slice(0, 3).join(', ')}` : '';
    
    let summary = `Results-oriented ${title}${company} with a proven track record of success${skillText}. Experienced in leading projects, driving cross-functional collaboration, and delivering high-quality outcomes. `;
    if (exp.length > 1) {
      summary += `Previously held key positions, demonstrating versatile expertise in industry best practices and solution design. `;
    }
    summary += `Committed to leveraging strategic skills to add immediate value and contribute to overall organizational growth.`;
    
    return { summary };
  }

  const personal = sections?.personal || {};
  const experience = sections?.experience || [];
  const skills = sections?.skills?.technical || [];

  const experienceText = experience.slice(0, 3).map(e =>
    `- ${e.title} at ${e.company} (${e.startDate} - ${e.endDate || 'Present'}): ${e.description || ''}`
  ).join('\n');

  const prompt = `
Write a compelling 3-4 sentence professional resume summary for the following person.
Make it ATS-friendly, results-oriented, and tailored to: ${jobTitle || 'their target role'}.

Name: ${personal.fullName || 'Professional'}
Key Skills: ${skills.slice(0, 8).join(', ')}
Experience:
${experienceText}

Rules:
- Start with a strong professional title/description
- Highlight 2-3 key achievements or strengths
- Include years of experience if available
- End with a value proposition
- Keep it under 80 words
- Do NOT use "I" or first person
- Output ONLY the summary text, no preamble
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
    const job = (jobTitle || '').toLowerCase();
    let suggestions = [];
    if (job.includes('developer') || job.includes('engineer') || job.includes('programmer') || job.includes('tech') || job.includes('software')) {
      suggestions = ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "Git", "Docker", "AWS", "REST APIs", "Agile Development", "System Design"];
    } else if (job.includes('designer') || job.includes('ui') || job.includes('ux') || job.includes('creative')) {
      suggestions = ["Figma", "Adobe XD", "UI Design", "UX Research", "Wireframing", "Prototyping", "Design Systems", "HTML/CSS", "Visual Design", "User Testing"];
    } else if (job.includes('product') || job.includes('manager') || job.includes('project') || job.includes('scrum') || job.includes('lead')) {
      suggestions = ["Product Strategy", "Project Management", "Agile", "Scrum", "Jira", "Roadmapping", "Cross-functional Leadership", "Stakeholder Communication", "Market Research", "Risk Management"];
    } else if (job.includes('data') || job.includes('analyst') || job.includes('science') || job.includes('ml')) {
      suggestions = ["Python", "SQL", "Data Analysis", "Machine Learning", "Pandas/NumPy", "Tableau", "Power BI", "Data Visualization", "Statistics", "R"];
    } else if (job.includes('sales') || job.includes('marketing') || job.includes('business') || job.includes('growth')) {
      suggestions = ["SEO", "Digital Marketing", "Sales Strategy", "CRM (Salesforce)", "Content Creation", "Lead Generation", "Market Analysis", "Negotiation", "Public Relations", "Social Media Management"];
    } else {
      suggestions = ["Project Management", "Team Leadership", "Strategic Planning", "Problem Solving", "Process Optimization", "Client Relations", "Data Analysis", "Public Speaking", "Collaboration", "Agile Methodologies"];
    }
    return { skills: suggestions.filter(s => !existingSkills.includes(s)).slice(0, 8) };
  }

  const experienceText = (experience || []).slice(0, 2).map(e =>
    `${e.title} at ${e.company}`
  ).join(', ');

  const prompt = `
Suggest 12 highly relevant technical skills for a ${jobTitle || 'professional'} role.
${experienceText ? `Background: ${experienceText}` : ''}
${existingSkills.length ? `Already has: ${existingSkills.join(', ')}` : ''}

Return ONLY a JSON array of skill strings, no explanations.
Example: ["Python", "Machine Learning", "TensorFlow"]
Focus on specific, in-demand technical skills that employers search for.
`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const skills = JSON.parse(jsonMatch[0]);
      return { skills: skills.filter(s => !existingSkills.includes(s)).slice(0, 12) };
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
    const personal = sections?.personal || {};
    const exp = sections?.experience || [];
    const edu = sections?.education || [];
    const projects = sections?.projects || [];
    const custom = sections?.custom || [];
    const skills = [
      ...(sections?.skills?.technical || []),
      ...(sections?.skills?.soft || [])
    ];
    const roleProfile = buildRoleProfile(jobDescription, sections);
    const allText = normalizeText([
      personal.fullName,
      personal.summary,
      personal.location,
      personal.linkedin,
      personal.website,
      ...exp.flatMap(e => [e.title, e.company, e.location, e.description]),
      ...edu.flatMap(e => [e.degree, e.school, e.field]),
      ...projects.flatMap(e => [e.name, e.technologies, e.description]),
      ...skills,
      ...custom.flatMap(e => [e.name, e.description])
    ].join(' '));

    const skillText = normalizeText(skills.join(' '));
    let score = 40;
    const strengths = [];
    const improvements = [];
    const keywords_found = [];
    const keywords_missing = [];

    const contactFields = [personal.fullName, personal.email, personal.phone, personal.location];
    const contactBonus = contactFields.filter(Boolean).length >= 4 ? 10 : contactFields.filter(Boolean).length >= 3 ? 7 : 0;
    if (contactBonus > 0) {
      score += contactBonus;
      strengths.push('Contact information is complete and easy for ATS systems to parse');
    } else {
      improvements.push('Add full name, email, phone, and location so recruiters can contact you quickly');
    }

    if (personal.summary && personal.summary.length >= 60) {
      score += 8;
      strengths.push('Professional summary provides useful context for the target role');
      if (roleProfile.keywords.some(kw => normalizeText(personal.summary).includes(normalizeText(kw)))) {
        score += 4;
        strengths.push(`Summary contains keywords relevant to the ${roleProfile.industry} track`);
      } else {
        improvements.push(`Tailor the summary to the ${roleProfile.industry.toLowerCase()} role by using role-specific keywords`);
      }
    } else {
      improvements.push('Add a concise professional summary with role-specific keywords and impact');
    }

    if (exp.length > 0) {
      score += 12;
      strengths.push(`Work experience includes ${exp.length} role(s)`);

      const hasDesc = exp.some(e => e.description && e.description.length > 30);
      const bulletRich = countBulletSignals(exp) >= exp.length;
      const metricCount = countMetricSignals(exp.map(e => e.description || '').join(' '));
      const actionVerbHits = ['led', 'built', 'designed', 'developed', 'improved', 'optimized', 'delivered', 'managed', 'launched']
        .filter(verb => normalizeText(exp.map(e => e.description || '').join(' ')).includes(verb)).length;

      if (hasDesc) score += 6;
      if (bulletRich) score += 4;
      if (metricCount > 0) score += Math.min(6, metricCount * 2);
      if (actionVerbHits > 0) score += Math.min(4, actionVerbHits * 2);

      if (hasDesc) {
        strengths.push('Experience bullets give recruiters measurable detail');
      } else {
        improvements.push('Expand each role with bullets that explain achievements and impact');
      }

      if (metricCount === 0) {
        improvements.push('Add numbers, percentages, or dollar impact to show business results');
      }
    } else {
      improvements.push('Add your work history to highlight relevant professional experience');
    }

    if (skills.length >= 8) {
      score += 10;
      strengths.push(`Strong set of ${skills.length} skills listed`);
    } else if (skills.length >= 5) {
      score += 7;
      strengths.push(`Solid skill coverage with ${skills.length} skills listed`);
    } else {
      improvements.push('List at least 5 relevant technical or soft skills');
    }

    const { found: keywordHits, missing: keywordMisses } = getUniqueHits([allText, skillText].join(' '), roleProfile.keywords);
    const keywordScore = Math.min(14, keywordHits.length * 2);
    score += keywordScore;
    if (keywordHits.length > 0) {
      strengths.push(`Resume uses ${keywordHits.length} role-relevant keyword(s) for ${roleProfile.industry}`);
    }
    if (keywordMisses.length > 0) {
      improvements.push(`Add missing ${roleProfile.industry.toLowerCase()} keywords such as ${keywordMisses.slice(0, 3).join(', ')}`);
    }

    if (edu.length > 0) {
      score += 6;
      if (edu.some(e => e.degree || e.school)) {
        score += 3;
      }
      strengths.push('Education section supports screening and credential checks');
    } else {
      improvements.push('Include education details to meet minimum candidate requirements');
    }

    if (projects.length > 0) {
      score += 6;
      if (projects.some(p => p.description && p.description.length > 20)) score += 2;
      strengths.push('Project work adds extra evidence of applied skills');
    } else if (roleProfile.industry === 'Technology' || roleProfile.industry === 'Data & Analytics') {
      improvements.push('Add one or two projects to demonstrate practical experience');
    }

    if (custom.length > 0) {
      score += 2;
    }

    if (strengths.length === 0) strengths.push("Valid document format");
    if (improvements.length === 0) improvements.push("Tailor bullet points further with specific action verbs");

    roleProfile.keywords.forEach(kw => {
      if (allText.includes(normalizeText(kw)) || skillText.includes(normalizeText(kw))) {
        keywords_found.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      } else {
        keywords_missing.push(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    });

    if (countMetricSignals(JSON.stringify(sections)) > 0) {
      strengths.push('Resume includes measurable outcomes');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      industry: roleProfile.industry,
      strengths: strengths.slice(0, 3),
      improvements: improvements.slice(0, 4),
      keywords_found: keywords_found.slice(0, 5),
      keywords_missing: keywords_missing.slice(0, 5)
    };
  }

  const personal = sections?.personal || {};
  const experience = sections?.experience || [];
  const skills = [
    ...(sections?.skills?.technical || []),
    ...(sections?.skills?.soft || [])
  ];
  const education = sections?.education || [];
  const roleProfile = buildRoleProfile(jobDescription, sections);

  const resumeText = `
Name: ${personal.fullName}
Summary: ${personal.summary}
Skills: ${skills.join(', ')}
Experience: ${experience.map(e => `${e.title} at ${e.company}: ${e.description}`).join(' | ')}
Education: ${education.map(e => `${e.degree} at ${e.school}`).join(', ')}
  `.trim();

  const prompt = `
Analyze this resume for ATS (Applicant Tracking System) compatibility.
Focus on this industry/role profile: ${roleProfile.industry}.
${jobDescription ? `Job Description / Target Role Context: ${jobDescription}\n` : ''}

Use a weighted scoring approach. Weigh contact completeness, summary relevance, role-aligned keywords, quantifiable impact, skills coverage, experience depth, and education/projects for the target industry.

Resume Content:
${resumeText}

Respond with ONLY valid JSON in this exact format:
{
  "score": <number 0-100>,
  "industry": "<detected industry>",
  "strengths": [<up to 3 short strength strings>],
  "improvements": [<up to 4 specific actionable improvement strings>],
  "keywords_found": [<relevant keywords found>],
  "keywords_missing": [<important keywords missing for the role>]
}
`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { score: 0, feedback: [] };
  } catch (err) {
    return { score: 0, feedback: [], error: err.message };
  }
}

/**
 * Rewrite content to be more impactful
 */
async function rewriteContent(content, context = '', tone = 'professional') {
  if (useMockAI || !model) {
    if (!content) return { rewritten: '' };
    
    let cleaned = content.trim();
    cleaned = cleaned.replace(/^[•\-\*\s]+/, '');
    
    const verbs = ["Spearheaded", "Led", "Optimized", "Designed and implemented", "Collaborated on", "Drove", "Facilitated", "Formulated", "Executed"];
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    
    let rest = cleaned;
    if (cleaned.length > 0) {
      const firstChar = cleaned.charAt(0);
      const words = cleaned.split(' ');
      const commonVerbs = ["manage", "helped", "do", "did", "made", "work", "worked", "develop", "developed", "create", "created", "build", "built"];
      if (commonVerbs.includes(words[0].toLowerCase())) {
        words[0] = verb;
        rest = words.join(' ');
      } else {
        rest = firstChar.toLowerCase() + cleaned.slice(1);
        rest = `${verb} ${rest}`;
      }
    }
    
    if (!rest.includes('%') && !rest.includes('$') && !rest.match(/\b\d+\b/)) {
      const metricPhrases = [
        ", resulting in a 15% increase in efficiency",
        ", driving a 20% growth in team output",
        ", reducing operational bottlenecks by 25%",
        " to deliver key project milestones ahead of schedule"
      ];
      rest += metricPhrases[Math.floor(Math.random() * metricPhrases.length)];
    }

    return { rewritten: rest };
  }

  const prompt = `
Rewrite the following resume content to be more impactful, ATS-friendly, and results-oriented.
Tone: ${tone}
${context ? `Context: ${context}` : ''}

Original: "${content}"

Rules:
- Start with strong action verbs (e.g., Led, Developed, Increased, Optimized)
- Include quantifiable metrics where possible (use placeholders like [X%] if needed)
- Keep similar length to original
- Make it more compelling and specific
- Output ONLY the rewritten text, no explanations
`;

  try {
    const text = await callGemini(prompt);
    return { rewritten: text.trim() };
  } catch (err) {
    return { rewritten: content, error: err.message };
  }
}

/**
 * Full resume optimization
 */
async function optimizeResume(sections) {
  if (useMockAI || !model) {
    const personal = sections?.personal || {};
    const exp = sections?.experience || [];
    const edu = sections?.education || [];
    const skills = [
      ...(sections?.skills?.technical || []),
      ...(sections?.skills?.soft || [])
    ];
    
    const suggestions = [];

    if (!personal.summary || personal.summary.length < 30) {
      suggestions.push({
        section: "summary",
        priority: "high",
        suggestion: "Your summary statement is too short or missing. Add a dynamic 3-4 sentence professional pitch here."
      });
    }

    if (exp.length === 0) {
      suggestions.push({
        section: "experience",
        priority: "high",
        suggestion: "Work history section is empty. Please add relevant roles to demonstrate your experience."
      });
    } else {
      const shortDesc = exp.some(e => !e.description || e.description.length < 30);
      if (shortDesc) {
        suggestions.push({
          section: "experience",
          priority: "medium",
          suggestion: "Some of your experience entries have brief descriptions. Elaborate on responsibilities and key achievements."
        });
      }
    }

    if (skills.length < 5) {
      suggestions.push({
        section: "skills",
        priority: "medium",
        suggestion: "Include at least 5 technical or soft skills to help match keyword filtering by ATS scanners."
      });
    }

    if (edu.length === 0) {
      suggestions.push({
        section: "education",
        priority: "low",
        suggestion: "Add your academic qualifications, degrees, or current certifications to round out your profile."
      });
    }

    if (suggestions.length === 0) {
      suggestions.push({
        section: "overall",
        priority: "low",
        suggestion: "Looking great! Try tailoring bullet points specifically to your target job descriptions using the AI Rewrite tool."
      });
    }

    return { suggestions };
  }

  const experience = sections?.experience || [];
  const skills = sections?.skills?.technical || [];
  const education = sections?.education || [];

  const prompt = `
Review this resume and provide 5-7 specific, actionable optimization suggestions.

Experience entries: ${experience.length}
Skills count: ${skills.length}
Education entries: ${education.length}
Has summary: ${!!sections?.personal?.summary}
Summary length: ${(sections?.personal?.summary || '').length} chars

Common issues to check:
- Missing or weak summary
- Too few/many skills listed
- Lack of quantified achievements
- Missing keywords
- Experience descriptions too vague
- Education section completeness

Return ONLY a JSON array of suggestion objects:
[
  {
    "section": "summary|experience|skills|education|overall",
    "priority": "high|medium|low",
    "suggestion": "specific actionable suggestion"
  }
]
`;

  try {
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return { suggestions: JSON.parse(jsonMatch[0]) };
    }
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
