const express = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const studentDashboard = require('../services/studentDashboard.service');

const router = express.Router();

router.use(requireAuth);

router.get('/dashboard', asyncHandler(async (req, res) => {
  res.json(await studentDashboard.getDashboard(req.user.id));
}));

module.exports = router;
