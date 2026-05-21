const router = require('express').Router();
const db = require('../config/db');

/**
 * GET /api/templates
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM templates ORDER BY is_premium ASC, name ASC'
    );
    res.json({ templates: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/templates/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
