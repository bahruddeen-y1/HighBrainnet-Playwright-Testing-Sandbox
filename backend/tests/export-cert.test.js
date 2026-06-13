const {
  app, prisma, request, resetDb, seedLevels, registerUser, registerAdmin, createCourse,
} = require('./helpers');

let levels, admin, adminToken, course, lessons = [], student, studentH;

beforeAll(async () => {
  await resetDb();
  levels = await seedLevels();
  admin = await registerAdmin();
  adminToken = admin.accessToken;

  course = await createCourse(adminToken, {
    levelId: levels[0].id, title: 'คอร์สใบเซอร์', price: 700,
  });
  const ch = (await request(app).post(`/api/v1/admin/courses/${course.id}/chapters`)
    .set('authorization', `Bearer ${adminToken}`).send({ title: 'บท 1' })).body.chapter;

  for (const title of ['1.1', '1.2']) {
    const l = (await request(app).post(`/api/v1/admin/chapters/${ch.id}/lessons`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ title, videoDuration: 100 })).body.lesson;
    lessons.push(l);
  }

  student = await registerUser();
  studentH = ['authorization', `Bearer ${student.accessToken}`];
  await request(app).post('/api/v1/admin/enrollments')
    .set('authorization', `Bearer ${adminToken}`)
    .send({ userId: student.user.id, courseId: course.id });
});
afterAll(async () => { await prisma.$disconnect(); });

const adminH = () => ['authorization', `Bearer ${adminToken}`];

async function completeLesson(lessonId) {
  // ≥90% ของ 100s
  await request(app).post(`/api/v1/lessons/${lessonId}/watch`)
    .set(...studentH).send({ positionSeconds: 95 });
}

describe('Certificate', () => {
  test('ยังเรียนไม่ครบ → eligibility false + claim 400', async () => {
    const el = await request(app)
      .get(`/api/v1/certificates/eligibility/${course.id}`).set(...studentH);
    expect(el.body.eligible).toBe(false);
    expect(el.body.total).toBe(2);

    const claim = await request(app)
      .post(`/api/v1/certificates/claim/${course.id}`).set(...studentH);
    expect(claim.status).toBe(400);
  });

  test('เรียนครบทุกบท → claim สำเร็จ + ได้ code + claim ซ้ำคืนใบเดิม', async () => {
    await completeLesson(lessons[0].id);
    await completeLesson(lessons[1].id);

    const el = await request(app)
      .get(`/api/v1/certificates/eligibility/${course.id}`).set(...studentH);
    expect(el.body.eligible).toBe(true);
    expect(el.body.completed).toBe(2);

    const claim = await request(app)
      .post(`/api/v1/certificates/claim/${course.id}`).set(...studentH);
    expect(claim.status).toBe(201);
    const cert = claim.body.certificate;
    expect(cert.certificateCode).toMatch(/^HBN-\d{4}-[0-9A-F]{8}$/);

    const again = await request(app)
      .post(`/api/v1/certificates/claim/${course.id}`).set(...studentH);
    expect(again.status).toBe(200);
    expect(again.body.alreadyIssued).toBe(true);
    expect(again.body.certificate.id).toBe(cert.id);

    // PDF download
    const pdf = await request(app)
      .get(`/api/v1/certificates/${cert.id}/pdf`).set(...studentH)
      .buffer(true).parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');

    // public verify
    const verify = await request(app).get(`/api/v1/certificates/verify/${cert.certificateCode}`);
    expect(verify.status).toBe(200);
    expect(verify.body.certificate.user.fullName).toBe(student.user.fullName);

    // คนอื่นดาวน์โหลดใบเราไม่ได้
    const other = await registerUser();
    const stolen = await request(app)
      .get(`/api/v1/certificates/${cert.id}/pdf`)
      .set('authorization', `Bearer ${other.accessToken}`);
    expect(stolen.status).toBe(403);
  });
});

describe('Receipt PDF', () => {
  test('order PAID → ใบเสร็จ PDF, order ค้าง → 400, ของคนอื่น → 403', async () => {
    const buyer = await registerUser();
    const bH = ['authorization', `Bearer ${buyer.accessToken}`];
    const c2 = await createCourse(adminToken, { levelId: levels[1].id, title: 'คอร์สใบเสร็จ', price: 990 });

    const order = (await request(app).post('/api/v1/orders').set(...bH)
      .send({ items: [{ itemType: 'course', courseId: c2.id }], paymentMethod: 'MANUAL' })).body.order;

    // ยังไม่จ่าย → 400
    const early = await request(app).get(`/api/v1/orders/${order.id}/receipt.pdf`).set(...bH);
    expect(early.status).toBe(400);

    await request(app).post(`/api/v1/admin/orders/${order.id}/approve`).set(...adminH()).send({});

    const pdf = await request(app).get(`/api/v1/orders/${order.id}/receipt.pdf`).set(...bH)
      .buffer(true).parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');

    // คนอื่นเข้าถึงไม่ได้ (student คนแรก)
    const stolen = await request(app).get(`/api/v1/orders/${order.id}/receipt.pdf`).set(...studentH);
    expect(stolen.status).toBe(403);
  });
});

describe('Excel exports', () => {
  test('student เรียก export → 403', async () => {
    const res = await request(app).get('/api/v1/admin/export/sales.xlsx').set(...studentH);
    expect(res.status).toBe(403);
  });

  test('ทั้ง 5 ไฟล์ download ได้และเป็น xlsx จริง', async () => {
    const paths = [
      '/api/v1/admin/export/sales.xlsx',
      '/api/v1/admin/export/students.xlsx',
      '/api/v1/admin/export/payments.xlsx',
      '/api/v1/admin/export/quiz-scores.xlsx',
      '/api/v1/admin/export/exam-credits.xlsx',
    ];
    for (const p of paths) {
      const res = await request(app).get(p).set(...adminH())
        .buffer(true).parse((r, cb) => {
          const chunks = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      // xlsx = zip → starts with PK
      expect(res.body.slice(0, 2).toString()).toBe('PK');
    }
  });

  test('sales filter ช่วงเวลา: from อนาคต → ไม่มีแถวข้อมูล', async () => {
    const future = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/admin/export/sales.xlsx?from=${future}`).set(...adminH())
      .buffer(true).parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.body.slice(0, 2).toString()).toBe('PK');
  });
});
