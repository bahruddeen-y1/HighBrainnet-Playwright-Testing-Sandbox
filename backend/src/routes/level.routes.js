const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../config/prisma');

const router = express.Router();

router.get('/', asyncHandler(async (_req, res) => {
  const levels = await prisma.courseLevel.findMany({
    where: { isDeleted: false },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, key: true, name: true, description: true, sortOrder: true },
  });
  res.json({ items: levels });
}));

module.exports = router;
