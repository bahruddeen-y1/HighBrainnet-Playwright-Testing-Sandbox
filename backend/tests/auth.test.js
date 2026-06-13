const {
  app, prisma, request, resetDb, registerUser,
} = require('./helpers');

beforeAll(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('Auth', () => {
  test('register ต้องมี PDPA consent', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'nopdpa@test.com', password: 'password123', fullName: 'x',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.pdpaConsent).toBeDefined();
  });

  test('register สำเร็จ → ได้ token + pdpaConsentAt ถูกบันทึก', async () => {
    const { user, accessToken, refreshToken } = await registerUser();
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser.pdpaConsent).toBe(true);
    expect(dbUser.pdpaConsentAt).not.toBeNull();
  });

  test('email ซ้ำ → 409', async () => {
    const { user } = await registerUser();
    const res = await request(app).post('/api/v1/auth/register').send({
      email: user.email, password: 'password123', fullName: 'x', pdpaConsent: true,
    });
    expect(res.status).toBe(409);
  });

  test('login ผิดรหัส → 401 ข้อความเดียวกับ email ผิด (no user enumeration)', async () => {
    const { user } = await registerUser();
    const wrongPass = await request(app).post('/api/v1/auth/login')
      .send({ email: user.email, password: 'wrongpass' });
    const wrongEmail = await request(app).post('/api/v1/auth/login')
      .send({ email: 'ghost@test.com', password: 'password123' });
    expect(wrongPass.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPass.body.error.message).toBe(wrongEmail.body.error.message);
  });

  test('GET /auth/me ด้วย token ใช้งานได้', async () => {
    const { accessToken, user } = await registerUser();
    const res = await request(app).get('/api/v1/auth/me')
      .set('authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  test('single device: login ใหม่ kick token เก่า', async () => {
    const first = await registerUser();
    // second login (same user, "another device")
    const second = await request(app).post('/api/v1/auth/login')
      .send({ email: first.user.email, password: 'password123' });
    expect(second.status).toBe(200);

    const oldTokenRes = await request(app).get('/api/v1/auth/me')
      .set('authorization', `Bearer ${first.accessToken}`);
    expect(oldTokenRes.status).toBe(401);

    const newTokenRes = await request(app).get('/api/v1/auth/me')
      .set('authorization', `Bearer ${second.body.accessToken}`);
    expect(newTokenRes.status).toBe(200);
  });

  test('refresh token: rotate แล้วอันเก่าใช้ไม่ได้', async () => {
    const { refreshToken } = await registerUser();
    const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.accessToken).toBeTruthy();

    // old refresh token is revoked after rotation
    const r2 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(r2.status).toBe(401);
  });

  test('logout → token และ refresh ใช้ไม่ได้', async () => {
    const { accessToken, refreshToken } = await registerUser();
    await request(app).post('/api/v1/auth/logout')
      .set('authorization', `Bearer ${accessToken}`);

    const r = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(r.status).toBe(401);
  });
});
