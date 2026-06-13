const {
  app, prisma, request, resetDb, seedLevels, registerUser, registerAdmin, createCourse,
} = require('./helpers');

let levels, admin, adminToken;

beforeAll(async () => {
  await resetDb();
  levels = await seedLevels();
  admin = await registerAdmin();
  adminToken = admin.accessToken;
});
afterAll(async () => { await prisma.$disconnect(); });

const auth = () => ['authorization', `Bearer ${adminToken}`];

describe('Course CRUD + Versioning', () => {
  test('student เรียก admin API → 403', async () => {
    const student = await registerUser();
    const res = await request(app).post('/api/v1/admin/courses')
      .set('authorization', `Bearer ${student.accessToken}`)
      .send({ levelId: levels[0].id, title: 'hack', price: 1 });
    expect(res.status).toBe(403);
  });

  test('สร้างคอร์ส → auto v1.0 + currentVersion ตั้งให้', async () => {
    const course = await createCourse(adminToken, {
      levelId: levels[0].id, title: 'คณิตทดสอบ', price: 1500,
    });
    expect(course.currentVersionId).toBeTruthy();
    expect(course.currentVersion.versionLabel).toBe('v1.0');
  });

  test('slug ไทยล้วน → auto-generate slug ใช้งานได้', async () => {
    const course = await createCourse(adminToken, {
      levelId: levels[0].id, title: 'คณิตศาสตร์เท่านั้น', price: 100,
    });
    expect(course.slug).toMatch(/^course-[0-9a-f]{8}$/);
  });

  test('soft delete → หายจาก public, ยังเห็นใน admin includeDeleted', async () => {
    const course = await createCourse(adminToken, {
      levelId: levels[0].id, title: 'จะถูกซ่อน', price: 100,
    });

    const del = await request(app).delete(`/api/v1/admin/courses/${course.id}`).set(...auth());
    expect(del.status).toBe(200);
    expect(del.body.affectedStudents).toBe(0);

    const pub = await request(app).get(`/api/v1/courses/${course.slug}`);
    expect(pub.status).toBe(404);

    const adminList = await request(app)
      .get('/api/v1/admin/courses?includeDeleted=true&includeHidden=true').set(...auth());
    expect(adminList.body.items.some((c) => c.id === course.id)).toBe(true);

    // restore
    const restore = await request(app)
      .post(`/api/v1/admin/courses/${course.id}/restore`).set(...auth());
    expect(restore.status).toBe(200);
    const pub2 = await request(app).get(`/api/v1/courses/${course.slug}`);
    expect(pub2.status).toBe(200);
  });

  test('chapter + lesson + reorder + tree ลำดับถูก', async () => {
    const course = await createCourse(adminToken, {
      levelId: levels[1].id, title: 'คอร์ส tree', price: 100,
    });

    const ch1 = (await request(app).post(`/api/v1/admin/courses/${course.id}/chapters`)
      .set(...auth()).send({ title: 'บทแรก' })).body.chapter;
    const ch2 = (await request(app).post(`/api/v1/admin/courses/${course.id}/chapters`)
      .set(...auth()).send({ title: 'บทสอง' })).body.chapter;

    await request(app).post(`/api/v1/admin/chapters/${ch1.id}/lessons`)
      .set(...auth()).send({ title: 'หัวข้อ 1.1', videoDuration: 300 });

    // swap order
    await request(app).post(`/api/v1/admin/courses/${course.id}/chapters/reorder`)
      .set(...auth()).send({ items: [{ id: ch1.id, sortOrder: 1 }, { id: ch2.id, sortOrder: 0 }] });

    const tree = (await request(app).get(`/api/v1/courses/${course.slug}/tree`)).body.course;
    expect(tree.chapters[0].id).toBe(ch2.id);
    expect(tree.chapters[1].id).toBe(ch1.id);
    expect(tree.chapters[1].lessons).toHaveLength(1);
    // public tree must not leak bunnyVideoId
    expect(tree.chapters[1].lessons[0].bunnyVideoId).toBeUndefined();
  });

  test('reorder ข้ามคอร์ส → 400', async () => {
    const courseA = await createCourse(adminToken, { levelId: levels[0].id, title: 'A', price: 1 });
    const courseB = await createCourse(adminToken, { levelId: levels[0].id, title: 'B', price: 1 });
    const chA = (await request(app).post(`/api/v1/admin/courses/${courseA.id}/chapters`)
      .set(...auth()).send({ title: 'a1' })).body.chapter;

    const res = await request(app).post(`/api/v1/admin/courses/${courseB.id}/chapters/reorder`)
      .set(...auth()).send({ items: [{ id: chA.id, sortOrder: 0 }] });
    expect(res.status).toBe(400);
  });

  test('versioning: publish v1.1 → currentVersion เปลี่ยน, ลบ current ไม่ได้', async () => {
    const course = await createCourse(adminToken, { levelId: levels[2].id, title: 'มี v2', price: 900 });

    const v11 = (await request(app).post(`/api/v1/admin/courses/${course.id}/versions`)
      .set(...auth()).send({ versionLabel: 'v1.1', upgradePrice: 250, publish: true })).body.version;

    const detail = (await request(app).get(`/api/v1/courses/${course.slug}`)).body.course;
    expect(detail.currentVersion.versionLabel).toBe('v1.1');
    expect(detail.currentVersion.upgradePrice).toBe('250');

    const del = await request(app).delete(`/api/v1/admin/versions/${v11.id}`).set(...auth());
    expect(del.status).toBe(409);
  });

  test('versionLabel ซ้ำ → 409', async () => {
    const course = await createCourse(adminToken, { levelId: levels[0].id, title: 'dup ver', price: 1 });
    const res = await request(app).post(`/api/v1/admin/courses/${course.id}/versions`)
      .set(...auth()).send({ versionLabel: 'v1.0' });
    expect(res.status).toBe(409);
  });
});
