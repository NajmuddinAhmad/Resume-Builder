const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, optionalAuth } = require('../middleware/auth');
const pdfService = require('../services/pdfService');
const { createClient } = require('@supabase/supabase-js');
let htmlDocx = null;
try {
  htmlDocx = require('html-docx-js');
} catch (e) {
  // optional dependency; we'll fall back to generating a .docx via `docx` package
}
const { Document, Packer, Paragraph, TextRun } = require('docx');

/**
 * GET /api/resumes
 * List user's resumes with search/filter/pagination
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, page = 1, limit = 12, sort = 'updated_at' } = req.query;
    const offset = (page - 1) * limit;
    const validSorts = ['updated_at', 'created_at', 'title', 'ats_score'];
    const sortCol = validSorts.includes(sort) ? sort : 'updated_at';

    let whereClause = 'WHERE r.user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND r.title ILIKE $${params.length}`;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM resumes r ${whereClause}`,
      params
    );

    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const result = await db.query(
      `SELECT r.id, r.title, r.template_id, r.ats_score, r.downloads, r.views,
              r.created_at, r.updated_at, r.share_token, r.is_public,
              t.name as template_name,
              r.sections->>'personal' as personal_data
       FROM resumes r
       LEFT JOIN templates t ON r.template_id = t.id
       ${whereClause}
       ORDER BY r.${sortCol} DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      resumes: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/resumes
 * Create a new resume
 */
router.post('/', authenticate, [
  body('title').optional().trim(),
  body('template_id').optional().isString()
], async (req, res, next) => {
  try {
    const { title = 'Untitled Resume', template_id = 'manhattan' } = req.body;

    const defaultSections = {
      personal: {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        website: '',
        linkedin: '',
        summary: ''
      },
      experience: [],
      education: [],
      skills: { technical: [], soft: [] },
      projects: [],
      certifications: [],
      languages: [],
      sectionOrder: ['personal', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages'],
      activeSections: ['personal', 'experience', 'education', 'skills']
    };

    const defaultStyling = {
      font: 'Inter',
      primaryColor: '#6366f1',
      accentColor: '#8b5cf6',
      fontSize: 'medium',
      spacing: 'normal',
      lineHeight: 1.5
    };

    const result = await db.query(
      `INSERT INTO resumes (user_id, title, template_id, sections, styling)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, title, template_id, JSON.stringify(defaultSections), JSON.stringify(defaultStyling)]
    );

    res.status(201).json({ resume: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resumes/:id
 * Get a single resume
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.*, t.name as template_name, t.category as template_category
       FROM resumes r
       LEFT JOIN templates t ON r.template_id = t.id
       WHERE r.id = $1 AND r.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.json({ resume: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/resumes/:id
 * Update resume (autosave)
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { title, template_id, sections, styling, ats_score } = req.body;

    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://aihmhvlhthfodikgzfsn.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaG1odmxodGhmb2Rpa2d6ZnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY4NDAsImV4cCI6MjA5NDg0Mjg0MH0.AEgff0NpZLHr_B2MHx6sFB9V2wNcpLURBveOrMCm2to',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (template_id !== undefined) updates.template_id = template_id;
    if (sections !== undefined) updates.sections = sections;
    if (styling !== undefined) updates.styling = styling;
    if (ats_score !== undefined) updates.ats_score = ats_score;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1 && updates.updated_at) {
      return res.json({ message: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('resumes')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, title, template_id, ats_score, updated_at')
      .single();

    if (error) {
      console.error('Supabase backend update error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    res.json({ resume: data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/resumes/:id
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'DELETE FROM resumes WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    res.json({ message: 'Resume deleted', id: req.params.id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/resumes/:id/duplicate
 */
router.post('/:id/duplicate', authenticate, async (req, res, next) => {
  try {
    const original = await db.query(
      'SELECT * FROM resumes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (original.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const resume = original.rows[0];
    const result = await db.query(
      `INSERT INTO resumes (user_id, title, template_id, sections, styling)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, `${resume.title} (Copy)`, resume.template_id, resume.sections, resume.styling]
    );

    res.status(201).json({ resume: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resumes/:id/export/pdf
 */
router.get('/:id/export/pdf', authenticate, async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://aihmhvlhthfodikgzfsn.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaG1odmxodGhmb2Rpa2d6ZnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY4NDAsImV4cCI6MjA5NDg0Mjg0MH0.AEgff0NpZLHr_B2MHx6sFB9V2wNcpLURBveOrMCm2to',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: resume, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const pdfBuffer = await pdfService.generatePDF(resume);

    await supabase
      .from('resumes')
      .update({ downloads: (resume.downloads || 0) + 1 })
      .eq('id', req.params.id);

    const filename = `${(resume.title || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}_resume.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resumes/:id/export/docx
 * Export resume as DOCX (best-effort). If `html-docx-js` is installed, convert HTML to real .docx.
 * Otherwise fall back to sending HTML with a .doc extension (Word can open HTML documents).
 */
router.get('/:id/export/docx', authenticate, async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://aihmhvlhthfodikgzfsn.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaG1odmxodGhmb2Rpa2d6ZnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjY4NDAsImV4cCI6MjA5NDg0Mjg0MH0.AEgff0NpZLHr_B2MHx6sFB9V2wNcpLURBveOrMCm2to',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: resume, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Use html-docx-js to generate native DOCX buffer
    try {
      const docxBuffer = await pdfService.generateDOCX(resume);

      try {
        await supabase.storage.from('resumes').upload(
          `${req.params.id}/resume.docx`, 
          docxBuffer, 
          { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: true }
        );
      } catch (uploadErr) {
        console.warn('Storage upload error (DOCX)', uploadErr.message);
      }

      await supabase
        .from('resumes')
        .update({ downloads: (resume.downloads || 0) + 1 })
        .eq('id', req.params.id);

      const filename = `${(resume.title || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}_resume.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(docxBuffer));
    } catch (screenshotErr) {
      console.warn('Screenshot-based DOCX generation failed, falling back to HTML .doc response', screenshotErr.message || screenshotErr);
      
      const docHtml = pdfService.buildDocxHTML(resume);
      
      // Upload fallback .doc to Supabase Storage
      try {
        await supabase.storage.from('resumes').upload(
          `${req.params.id}/resume.doc`, 
          docHtml, 
          { contentType: 'application/msword', upsert: true }
        );
      } catch (uploadErr) {
        console.warn('Storage upload error (DOCX fallback)', uploadErr.message);
      }

      await supabase
        .from('resumes')
        .update({ downloads: (resume.downloads || 0) + 1 })
        .eq('id', req.params.id);
        
      const filename = `${(resume.title || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}_resume.doc`;
      res.setHeader('Content-Type', 'application/msword');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(docHtml);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/resumes/:id/share
 * Generate or get share link
 */
router.post('/:id/share', authenticate, async (req, res, next) => {
  try {
    const { isPublic = true } = req.body;
    let shareToken = uuidv4().replace(/-/g, '').substring(0, 16);

    const result = await db.query(
      `UPDATE resumes SET share_token = $1, is_public = $2
       WHERE id = $3 AND user_id = $4
       RETURNING share_token`,
      [shareToken, isPublic, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/share/${result.rows[0].share_token}`;
    res.json({ shareUrl, shareToken: result.rows[0].share_token });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resumes/share/:token
 * Public share view
 */
router.get('/share/:token', optionalAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.name as author_name
       FROM resumes r
       JOIN users u ON r.user_id = u.id
       WHERE r.share_token = $1 AND r.is_public = TRUE`,
      [req.params.token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found or not public' });
    }

    await db.query('UPDATE resumes SET views = views + 1 WHERE share_token = $1', [req.params.token]);
    res.json({ resume: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/resumes/stats/overview
 */
router.get('/stats/overview', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*) as total_resumes,
         COALESCE(AVG(ats_score) FILTER (WHERE ats_score > 0), 0)::INTEGER as avg_ats_score,
         COALESCE(SUM(downloads), 0) as total_downloads,
         COALESCE(SUM(views), 0) as total_views
       FROM resumes WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ stats: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
