const {
  app, prisma, request, resetDb, seedLevels, registerUser, registerAdmin, createCourse,
} = require('./helpers');

let levels, admin, adminToken, course;

beforeAll(async () => {
  await resetDb();
  levels = await seedLevels();
  admin = await registerAdmin();
  adminToken = admin.accessToken;
  course = await createCourse(adminToken, {
    levelId: levels[0].id, title: 'คอร์สชำระเงิน', price: 1990,
  });
});
afterAll(async () => { await prisma.$disconnect(); });

async function buyCourse(studentToken, targetCourse = course) {
  const order = (await request(app).post('/api/v1/orders')
    .set('authorization', `Bearer ${studentToken}`)
    .send({ items: [{ itemType: 'course', courseId: targetCourse.id }] })).body.order;

  const pay = (await request(app).post(`/api/v1/orders/${order.id}/payment`)
    .set('authorization', `Bearer ${studentToken}`).send({})).body;

  return { order, pay };
}

function sendWebhook(orderNumber, gatewayRef, { signature = 'mock', resultCode = '00' } = {}) {
  return request(app).post('/api/v1/webhooks/gbprimepay')
    .set('x-gbpay-signature', signature)
    .send({ referenceNo: orderNumber, gbpReferenceNo: gatewayRef, resultCode });
}

describe('Orders + Payment + Webhook', () => {
  test('idempotency-key ซ้ำ → ได้ order เดิม', async () => {
    const s = await registerUser();
    const h = ['authorization', `Bearer ${s.accessToken}`];
    const body = { items: [{ itemType: 'course', courseId: course.id }] };

    const r1 = await request(app).post('/api/v1/orders').set(...h)
      .set('idempotency-key', 'same-key-1').send(body);
    const r2 = await request(app).post('/api/v1/orders').set(...h)
      .set('idempotency-key', 'same-key-1').send(body);
    expect(r1.body.order.id).toBe(r2.body.order.id);
  });

  test('webhook ปลอม (signature ผิด) → 401 และ order ไม่เปลี่ยน', async () => {
    const s = await registerUser();
    const { order, pay } = await buyCourse(s.accessToken);

    const res = await sendWebhook(order.orderNumber, pay.gatewayRef, { signature: 'fake!!' });
    expect(res.status).toBe(401);

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    expect(after.status).toBe('AWAITING_PAYMENT');
  });

  test('webhook สำเร็จ → PAID + enrollment + version access', async () => {
    const s = await registerUser();
    const { order, pay } = await buyCourse(s.accessToken);

    const res = await sendWebhook(order.orderNumber, pay.gatewayRef);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    expect(after.status).toBe('PAID');

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: s.user.id, courseId: course.id },
    });
    expect(enrollment).not.toBeNull();

    const access = await prisma.studentVersionAccess.findFirst({
      where: { userId: s.user.id, versionId: enrollment.versionId },
    });
    expect(access).not.toBeNull();
  });

  test('duplicate webhook → idempotent ไม่สร้าง enrollment ซ้ำ', async () => {
    const s = await registerUser();
    const { order, pay } = await buyCourse(s.accessToken);

    await sendWebhook(order.orderNumber, pay.gatewayRef);
    const second = await sendWebhook(order.orderNumber, pay.gatewayRef);
    expect(second.body.alreadyPaid).toBe(true);

    const count = await prisma.enrollment.count({
      where: { userId: s.user.id, courseId: course.id },
    });
    expect(count).toBe(1);
  });

  test('ซื้อคอร์สที่มีแล้ว → 409', async () => {
    const s = await registerUser();
    const { order, pay } = await buyCourse(s.accessToken);
    await sendWebhook(order.orderNumber, pay.gatewayRef);

    const res = await request(app).post('/api/v1/orders')
      .set('authorization', `Bearer ${s.accessToken}`)
      .send({ items: [{ itemType: 'course', courseId: course.id }] });
    expect(res.status).toBe(409);
  });

  test('manual approve → PAID + enrollment + approvedBy บันทึก', async () => {
    const s = await registerUser();
    const order = (await request(app).post('/api/v1/orders')
      .set('authorization', `Bearer ${s.accessToken}`)
      .send({
        items: [{ itemType: 'course', courseId: course.id }],
        paymentMethod: 'MANUAL',
      })).body.order;

    const res = await request(app).post(`/api/v1/admin/orders/${order.id}/approve`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ notes: 'ตรวจสลิปแล้ว' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('PAID');
    expect(res.body.order.approvedById).toBe(admin.user.id);

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: s.user.id, courseId: course.id },
    });
    expect(enrollment).not.toBeNull();
  });

  test('approve order ที่ PAID แล้ว → 409', async () => {
    const s = await registerUser();
    const { order, pay } = await buyCourse(s.accessToken);
    await sendWebhook(order.orderNumber, pay.gatewayRef);

    const res = await request(app).post(`/api/v1/admin/orders/${order.id}/approve`)
      .set('authorization', `Bearer ${adminToken}`).send({});
    expect(res.status).toBe(409);
  });

  test('package ซื้อ → enrollment ครบทุกคอร์สใน bundle', async () => {
    const c2 = await createCourse(adminToken, { levelId: levels[1].id, title: 'คอร์สใน bundle', price: 800 });
    const pkg = (await request(app).post('/api/v1/admin/packages')
      .set('authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bundle ทดสอบ', discountPrice: 2000, courseIds: [course.id, c2.id] })).body.package;
    expect(Number(pkg.originalPrice)).toBe(1990 + 800);

    const s = await registerUser();
    const order = (await request(app).post('/api/v1/orders')
      .set('authorization', `Bearer ${s.accessToken}`)
      .send({ items: [{ itemType: 'package', packageId: pkg.id }] })).body.order;
    expect(Number(order.amount)).toBe(2000);

    const pay = (await request(app).post(`/api/v1/orders/${order.id}/payment`)
      .set('authorization', `Bearer ${s.accessToken}`).send({})).body;
    await sendWebhook(order.orderNumber, pay.gatewayRef);

    const enrollments = await prisma.enrollment.findMany({ where: { userId: s.user.id } });
    expect(enrollments).toHaveLength(2);
  });

  test('upgrade flow: ซื้อ v1.0 → publish v1.1 → /enrollments บอก upgrade → ซื้อส่วนต่าง', async () => {
    const target = await createCourse(adminToken, { levelId: levels[2].id, title: 'อัปเกรดได้', price: 1200 });
    const s = await registerUser();
    const h = ['authorization', `Bearer ${s.accessToken}`];

    const { order, pay } = await buyCourse(s.accessToken, target);
    await sendWebhook(order.orderNumber, pay.gatewayRef);

    // publish new version
    const v11 = (await request(app).post(`/api/v1/admin/courses/${target.id}/versions`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ versionLabel: 'v1.1', upgradePrice: 300, publish: true })).body.version;

    const enr = (await request(app).get('/api/v1/enrollments').set(...h)).body.items;
    const mine = enr.find((e) => e.courseId === target.id);
    expect(mine.hasUpgradeAvailable).toBe(true);
    expect(Number(mine.upgrade.upgradePrice)).toBe(300);

    // buy upgrade
    const upOrder = (await request(app).post('/api/v1/orders').set(...h)
      .send({ items: [{ itemType: 'upgrade', courseId: target.id, versionId: v11.id }] })).body.order;
    expect(Number(upOrder.amount)).toBe(300);

    const upPay = (await request(app).post(`/api/v1/orders/${upOrder.id}/payment`).set(...h).send({})).body;
    await sendWebhook(upOrder.orderNumber, upPay.gatewayRef);

    const accessCount = await prisma.studentVersionAccess.count({ where: { userId: s.user.id } });
    expect(accessCount).toBe(2); // v1.0 + v1.1
  });
});
