const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/video.service');

// ----- Admin -----
exports.adminCreateVideo = asyncHandler(async (req, res) => {
  const result = await service.createVideoForLesson(req.params.id);
  res.status(201).json(result);
});

exports.adminSyncVideo = asyncHandler(async (req, res) => {
  const result = await service.syncLessonVideo(req.params.id);
  res.json(result);
});

exports.adminDeleteVideo = asyncHandler(async (req, res) => {
  const result = await service.deleteLessonVideo(req.params.id);
  res.json(result);
});

// ----- Student -----
exports.getPlayback = asyncHandler(async (req, res) => {
  const result = await service.getPlaybackInfo(req.user.id, req.params.id, { ip: req.ip });
  res.json(result);
});

exports.postWatch = asyncHandler(async (req, res) => {
  const result = await service.updateWatchPosition(
    req.user.id,
    req.params.id,
    req.body.positionSeconds,
  );
  res.json(result);
});

exports.getProgress = asyncHandler(async (req, res) => {
  const result = await service.getLessonProgress(req.user.id, req.params.id);
  res.json(result);
});
