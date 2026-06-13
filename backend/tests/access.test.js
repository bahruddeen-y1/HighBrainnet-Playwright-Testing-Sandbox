const {
  app, prisma, request, resetDb, seedLevels, registerUser, registerAdmin, createCourse,
} = require('./helpers');

let levels, admin, adminToken, course, lessonId;

beforeAll(async () => {
  await resetDb();
  levels = await seedLevels();
  admin = await registerAdmin();
  adminToken = admin.accessToken;

  course = await createCourse(adminToken, {
    levelId: levels[0].id, title: 'คอร์สวิดีโอ', price: 500,
  });
  const ch = (await request(app).post(`/api/v1/admin/courses/${course.id}/chapters`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'บท 1' })).body.chapter;
  const lesson = (await request(app).post(`/api/v1/admin/chapters/${ch.id}/lessons`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'หัวข้อ 1.1' })).body.lesson;
  lessonId = lesson.id;

  // attach mock video → ready
  await request(app).post(`/api/v1/admin/lessons/${lessonId}/video`)
    .set('authorization', `Bearer ${adminToken}`);
  await request(app).post(`/api/v1/admin/lessons/${lessonId}/video/sync`)
    .set('authorization', `Bearer ${adminToken}`);
});
afterAll(async () => { await prisma.$disconnect(); });

async function grantEnrollment(userId, opts = {}) {
  return request(app).post('/api/v1/admin/enrollments')
    .set('authorization', `Bearer ${adminToken}`)
    .send({ userId, courseId: course.id, ...opts });
}

describe('Access control + playback', () => {
  test('ไม่มี token → 401', async () => {
    const res = await request(app).get(`/api/v1/lessons/${lessonId}/play`);
    expect(res.status).toBe(401);
  });

  test('ไม่มี enrollment → 403', async () => {
    const s = await registerUser();
    const res = await request(app).get(`/api/v1/lessons/${lessonId}/play`)
      .set('authorization', `Bearer ${s.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('admin gift → play ได้ + signed URL มี token', async () => {
    const s = await registerUser();
    await grantEnrollment(s.user.id);

    const res = await request(app).get(`/api/v1/lessons/${lessonId}/play`)
      .set('authorization', `Bearer ${s.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.urls.hls).toContain('token=');
    expect(res.body.urls.hls).toContain('expires=');
  });

  test('enrollment หมดอายุ → 403', async () => {
    const s = await registerUser();
    await grantEnrollment(s.user.id, {
      isLifetime: false,
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // yesterday
    });

    const res = await request(app).get(`/api/v1/lessons/${lessonId}/play`)
      .set('authorization', `Bearer ${s.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('revoke enrollment → access หาย', async () => {
    const s = await registerUser();
    const grant = await grantEnrollment(s.user.id);
    const enrollmentId = grant.body.enrollment.id;

    const ok = await request(app).get(`/api/v1/lessons/${lessonId}/play`)
      .set('authorization', `Bearer ${s.accessToken}`);
    expect(ok.status).toBe(200);

    await request(app).delete(`/api/v1/admin/enrollments/${enrollmentId}`)
      .set('authorization', `Bearer ${adminToken}`);

    const denied = await request(app).get(`/api/v1/lessons/${lessonId}/play`)
      .set('authorization', `Bearer ${s.accessToken}`);
    expect(denied.status).toBe(403);
  });

  test('watch ≥90% → isCompleted อัตโนมัติ', async () => {
    const s = await registerUser();
    await grantEnrollment(s.user.id);
    const h = ['authorization', `Bearer ${s.accessToken}`];

    // duration = 480 from mock sync
    await request(app).post(`/api/v1/lessons/${lessonId}/watch`).set(...h)
      .send({ positionSeconds: 100 });
    let prog = (await request(app).get(`/api/v1/lessons/${lessonId}/progress`).set(...h)).body;
    expect(prog.isWatched).toBe(true);
    expect(prog.isCompleted).toBe(false);
    expect(prog.resumeAt).toBe(100);

    await request(app).post(`/api/v1/lessons/${lessonId}/watch`).set(...h)
      .send({ positionSeconds: 450 });
    prog = (await request(app).get(`/api/v1/lessons/${lessonId}/progress`).set(...h)).body;
    expect(prog.isCompleted).toBe(true);
  });

  test('suspend user → login ถูกปฏิเสธ + token เดิมใช้ไม่ได้', async () => {
    const s = await registerUser();
    await request(app).post(`/api/v1/admin/users/${s.user.id}/suspend`)
      .set('authorization', `Bearer ${adminToken}`);

    const login = await request(app).post('/api/v1/auth/login')
      .send({ email: s.user.email, password: 'password123' });
    expect(login.status).toBe(403);

    const me = await request(app).get('/api/v1/auth/me')
      .set('authorization', `Bearer ${s.accessToken}`);
    expect([401, 403]).toContain(me.status);
  });

  test('suspend admin → 400', async () => {
    const res = await request(app).post(`/api/v1/admin/users/${admin.user.id}/suspend`)
      .set('authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  test('exam credits: public ซ่อนชื่อจริงตาม displayType', async () => {
    await request(app).post('/api/v1/admin/exam-credits')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ realName: 'ลับสุดยอด', alias: 'น้อง A', schoolName: 'รร.ทดสอบ', examYear: 2026, displayType: 'ALIAS' });

    const pub = await request(app).get('/api/v1/exam-credits');
    expect(pub.status).toBe(200);
    const item = pub.body.items.find((i) => i.schoolName === 'รร.ทดสอบ');
    expect(item.displayName).toBe('น้อง A');
    expect(JSON.stringify(pub.body)).not.toContain('ลับสุดยอด');
  });
});
