const asyncHandler = require('../utils/asyncHandler');
const exportService = require('../services/export.service');

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  await wb.xlsx.write(res);
  res.end();
}

exports.sales = asyncHandler(async (req, res) => {
  const wb = await exportService.salesWorkbook(req.query);
  await sendWorkbook(res, wb, 'sales.xlsx');
});

exports.students = asyncHandler(async (_req, res) => {
  const wb = await exportService.studentsWorkbook();
  await sendWorkbook(res, wb, 'students.xlsx');
});

exports.payments = asyncHandler(async (req, res) => {
  const wb = await exportService.paymentsWorkbook(req.query);
  await sendWorkbook(res, wb, 'payments.xlsx');
});

exports.quizScores = asyncHandler(async (req, res) => {
  const wb = await exportService.quizScoresWorkbook(req.query);
  await sendWorkbook(res, wb, 'quiz-scores.xlsx');
});

exports.examCredits = asyncHandler(async (req, res) => {
  const wb = await exportService.examCreditsWorkbook(req.query);
  await sendWorkbook(res, wb, 'exam-credits.xlsx');
});
