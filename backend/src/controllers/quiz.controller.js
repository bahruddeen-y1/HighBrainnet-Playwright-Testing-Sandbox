const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/quiz.service');

// ----- Admin -----
exports.createForLesson = asyncHandler(async (req, res) => {
  const quiz = await service.createForLesson(req.params.lessonId, req.body);
  res.status(201).json({ quiz });
});

exports.createForCourse = asyncHandler(async (req, res) => {
  const quiz = await service.createForCourse(req.params.courseId, req.body);
  res.status(201).json({ quiz });
});

exports.getAdmin = asyncHandler(async (req, res) => {
  const quiz = await service.getAdmin(req.params.id);
  res.json({ quiz });
});

exports.update = asyncHandler(async (req, res) => {
  const quiz = await service.update(req.params.id, req.body);
  res.json({ quiz });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json(await service.softDelete(req.params.id));
});

exports.addQuestion = asyncHandler(async (req, res) => {
  const question = await service.addQuestion(req.params.id, req.body);
  res.status(201).json({ question });
});

exports.updateQuestion = asyncHandler(async (req, res) => {
  const question = await service.updateQuestion(req.params.id, req.body);
  res.json({ question });
});

exports.removeQuestion = asyncHandler(async (req, res) => {
  res.json(await service.deleteQuestion(req.params.id));
});

exports.reorderQuestions = asyncHandler(async (req, res) => {
  const quiz = await service.reorderQuestions(req.params.id, req.body.items);
  res.json({ quiz });
});

// ----- Student -----
exports.getForStudent = asyncHandler(async (req, res) => {
  const quiz = await service.getForStudent(req.user.id, req.params.id);
  res.json({ quiz });
});

exports.start = asyncHandler(async (req, res) => {
  const attempt = await service.startAttempt(req.user.id, req.params.id);
  res.status(201).json(attempt);
});

exports.submit = asyncHandler(async (req, res) => {
  const result = await service.submit(req.user.id, req.params.id, req.body);
  res.json(result);
});

exports.myResults = asyncHandler(async (req, res) => {
  const data = await service.myResults(req.user.id, req.params.id);
  res.json(data);
});

exports.listForLesson = asyncHandler(async (req, res) => {
  const items = await service.listForLesson(req.user.id, req.params.lessonId);
  res.json({ items });
});

exports.listForCourse = asyncHandler(async (req, res) => {
  const items = await service.listForCourse(req.user.id, req.params.courseId);
  res.json({ items });
});
