const asyncHandler = require('../utils/asyncHandler');
const certService = require('../services/certificate.service');
const pdfService = require('../services/pdf.service');

exports.listMine = asyncHandler(async (req, res) => {
  const items = await certService.listMine(req.user.id);
  res.json({ items });
});

exports.eligibility = asyncHandler(async (req, res) => {
  const status = await certService.checkEligibility(req.user.id, req.params.courseId);
  res.json(status);
});

exports.claim = asyncHandler(async (req, res) => {
  const result = await certService.claim(req.user.id, req.params.courseId);
  res.status(result.alreadyIssued ? 200 : 201).json(result);
});

exports.downloadPdf = asyncHandler(async (req, res) => {
  const { doc, filename } = await pdfService.buildCertificate(req.params.id, {
    requesterId: req.user.id,
    isAdmin: req.user.role === 'ADMIN',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
});

exports.verify = asyncHandler(async (req, res) => {
  const certificate = await certService.verify(req.params.code);
  res.json({ certificate });
});

exports.receiptPdf = asyncHandler(async (req, res) => {
  const { doc, filename } = await pdfService.buildReceipt(req.params.id, {
    requesterId: req.user.id,
    isAdmin: req.user.role === 'ADMIN',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
});
