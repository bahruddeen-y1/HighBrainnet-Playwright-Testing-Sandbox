const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/certificate.controller');

const router = express.Router();

const courseIdParam = z.object({ courseId: z.string().uuid() });
const idParam = z.object({ id: z.string().uuid() });
const codeParam = z.object({ code: z.string().min(4).max(40) });

// public verify (ไม่ต้อง login)
router.get('/verify/:code', validate(codeParam, 'params'), ctrl.verify);

router.use(requireAuth);
router.get('/', ctrl.listMine);
router.get('/eligibility/:courseId', validate(courseIdParam, 'params'), ctrl.eligibility);
router.post('/claim/:courseId', validate(courseIdParam, 'params'), ctrl.claim);
router.get('/:id/pdf', validate(idParam, 'params'), ctrl.downloadPdf);

module.exports = router;
