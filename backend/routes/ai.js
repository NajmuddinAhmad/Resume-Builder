const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService');

/**
 * POST /api/ai/summary
 * Generate resume summary
 */
router.post('/summary', authenticate, async (req, res, next) => {
  try {
    const { sections, jobTitle } = req.body;
    const result = await aiService.generateSummary(sections, jobTitle);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/skills
 * Suggest skills based on job title/experience
 */
router.post('/skills', authenticate, async (req, res, next) => {
  try {
    const { jobTitle, experience, existingSkills } = req.body;
    const result = await aiService.suggestSkills(jobTitle, experience, existingSkills);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/ats-score
 * Analyze resume ATS score
 */
router.post('/ats-score', authenticate, async (req, res, next) => {
  try {
    const { sections, jobDescription } = req.body;
    const result = await aiService.analyzeATSScore(sections, jobDescription);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/rewrite
 * Rewrite a bullet point / section content
 */
router.post('/rewrite', authenticate, async (req, res, next) => {
  try {
    const { content, context, tone } = req.body;
    const result = await aiService.rewriteContent(content, context, tone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/optimize
 * Full resume optimization suggestions
 */
router.post('/optimize', authenticate, async (req, res, next) => {
  try {
    const { sections } = req.body;
    const result = await aiService.optimizeResume(sections);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
