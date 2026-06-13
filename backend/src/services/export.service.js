const ExcelJS = require('exceljs');
const prisma = require('../config/prisma');

const THAI_DATE = (d) =>
  d ? new Date(d).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '';

function newWorkbook(sheetName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HighBrainnet';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);
  return { wb, ws };
}

function styleHeader(ws) {
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8D9' },
  };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
}

function dateWhere(field, { from, to }) {
  const w = {};
  if (from) w.gte = from;
  if (to) {
    // include the whole "to" day
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    w.lte = end;
  }
  return Object.keys(w).length ? { [field]: w } : {};
}

// ---------- 1. ยอดขาย ----------
async function salesWorkbook({ from, to, courseId, levelId } = {}) {
  const where = {
    status: 'PAID',
    isDeleted: false,
    ...dateWhere('updatedAt', { from, to }),
  };
  if (courseId) {
    where.items = { some: { courseId } };
  }

  let orders = await prisma.order.findMany({
    where,
    orderBy: { updatedAt: 'asc' },
    include: {
      user: { select: { email: true, fullName: true } },
      items: true,
      payments: { where: { status: 'SUCCESS' }, take: 1 },
    },
  });

  if (levelId) {
    const levelCourses = await prisma.course.findMany({
      where: { levelId }, select: { id: true },
    });
    const ids = new Set(levelCourses.map((c) => c.id));
    orders = orders.filter((o) => o.items.some((i) => i.courseId && ids.has(i.courseId)));
  }

  const { wb, ws } = newWorkbook('ยอดขาย');
  ws.columns = [
    { header: 'วันที่ชำระ', key: 'paidAt', width: 22 },
    { header: 'เลขที่คำสั่งซื้อ', key: 'orderNumber', width: 24 },
    { header: 'นักเรียน', key: 'student', width: 28 },
    { header: 'อีเมล', key: 'email', width: 28 },
    { header: 'รายการ', key: 'items', width: 50 },
    { header: 'ช่องทาง', key: 'method', width: 14 },
    { header: 'ยอด (บาท)', key: 'amount', width: 14 },
  ];
  for (const o of orders) {
    ws.addRow({
      paidAt: THAI_DATE(o.payments[0]?.paidAt || o.updatedAt),
      orderNumber: o.orderNumber,
      student: o.user.fullName,
      email: o.user.email,
      items: o.items.map((i) => i.title).join(', '),
      method: o.paymentMethod === 'MANUAL' ? 'โอน/แนบสลิป' : 'QR PromptPay',
      amount: Number(o.amount),
    });
  }
  // summary row
  const total = orders.reduce((s, o) => s + Number(o.amount), 0);
  const sumRow = ws.addRow({ items: 'รวมทั้งหมด', amount: total });
  sumRow.font = { bold: true };
  ws.getColumn('amount').numFmt = '#,##0.00';
  styleHeader(ws);
  return wb;
}

// ---------- 2. รายชื่อนักเรียน ----------
async function studentsWorkbook() {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: {
      email: true, fullName: true, nickname: true, phone: true,
      createdAt: true, lastLoginAt: true, isSuspended: true,
      _count: { select: { enrollments: { where: { isDeleted: false } } } },
    },
  });

  const { wb, ws } = newWorkbook('รายชื่อนักเรียน');
  ws.columns = [
    { header: 'ชื่อ-นามสกุล', key: 'fullName', width: 28 },
    { header: 'ชื่อเล่น', key: 'nickname', width: 14 },
    { header: 'อีเมล', key: 'email', width: 30 },
    { header: 'เบอร์โทร', key: 'phone', width: 16 },
    { header: 'จำนวนคอร์ส', key: 'courses', width: 12 },
    { header: 'สมัครเมื่อ', key: 'createdAt', width: 22 },
    { header: 'เข้าระบบล่าสุด', key: 'lastLoginAt', width: 22 },
    { header: 'สถานะ', key: 'status', width: 12 },
  ];
  for (const s of students) {
    ws.addRow({
      fullName: s.fullName, nickname: s.nickname || '', email: s.email,
      phone: s.phone || '', courses: s._count.enrollments,
      createdAt: THAI_DATE(s.createdAt), lastLoginAt: THAI_DATE(s.lastLoginAt),
      status: s.isSuspended ? 'ระงับ' : 'ปกติ',
    });
  }
  styleHeader(ws);
  return wb;
}

// ---------- 3. ประวัติชำระ ----------
async function paymentsWorkbook({ from, to } = {}) {
  const payments = await prisma.payment.findMany({
    where: { ...dateWhere('createdAt', { from, to }) },
    orderBy: { createdAt: 'asc' },
    include: {
      order: {
        select: {
          orderNumber: true, status: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  });

  const { wb, ws } = newWorkbook('ประวัติชำระ');
  ws.columns = [
    { header: 'วันที่', key: 'createdAt', width: 22 },
    { header: 'เลขที่คำสั่งซื้อ', key: 'orderNumber', width: 24 },
    { header: 'นักเรียน', key: 'student', width: 28 },
    { header: 'Gateway', key: 'gateway', width: 14 },
    { header: 'Gateway Ref', key: 'ref', width: 26 },
    { header: 'สถานะ', key: 'status', width: 12 },
    { header: 'ชำระเมื่อ', key: 'paidAt', width: 22 },
    { header: 'ยอด (บาท)', key: 'amount', width: 14 },
  ];
  for (const p of payments) {
    ws.addRow({
      createdAt: THAI_DATE(p.createdAt),
      orderNumber: p.order.orderNumber,
      student: `${p.order.user.fullName} (${p.order.user.email})`,
      gateway: p.gateway,
      ref: p.gatewayRef || '',
      status: p.status,
      paidAt: THAI_DATE(p.paidAt),
      amount: Number(p.amount),
    });
  }
  ws.getColumn('amount').numFmt = '#,##0.00';
  styleHeader(ws);
  return wb;
}

// ---------- 4. คะแนน quiz ----------
async function quizScoresWorkbook({ courseId, quizId, from, to } = {}) {
  const where = { ...dateWhere('takenAt', { from, to }) };
  if (quizId) where.quizId = quizId;
  if (courseId && !quizId) {
    where.quiz = {
      OR: [
        { courseId },
        { lesson: { chapter: { courseId } } },
      ],
    };
  }

  const results = await prisma.quizResult.findMany({
    where,
    orderBy: { takenAt: 'asc' },
    include: {
      user: { select: { fullName: true, email: true } },
      quiz: { select: { title: true, isMockExam: true, passScore: true } },
    },
  });

  const { wb, ws } = newWorkbook('คะแนน Quiz');
  ws.columns = [
    { header: 'วันที่ทำ', key: 'takenAt', width: 22 },
    { header: 'นักเรียน', key: 'student', width: 28 },
    { header: 'ชุดข้อสอบ', key: 'quiz', width: 36 },
    { header: 'ประเภท', key: 'type', width: 12 },
    { header: 'คะแนน', key: 'score', width: 10 },
    { header: 'เต็ม', key: 'maxScore', width: 8 },
    { header: 'เปอร์เซ็นต์', key: 'percentage', width: 12 },
    { header: 'เวลาที่ใช้ (วินาที)', key: 'timeUsed', width: 16 },
    { header: 'ผล', key: 'passed', width: 10 },
  ];
  for (const r of results) {
    ws.addRow({
      takenAt: THAI_DATE(r.takenAt),
      student: `${r.user.fullName} (${r.user.email})`,
      quiz: r.quiz.title,
      type: r.quiz.isMockExam ? 'Mock Exam' : 'Quiz',
      score: r.score, maxScore: r.maxScore,
      percentage: r.percentage,
      timeUsed: r.timeUsedSeconds ?? '',
      passed: r.isPassed ? 'ผ่าน' : 'ไม่ผ่าน',
    });
  }
  styleHeader(ws);
  return wb;
}

// ---------- 5. รายชื่อสอบติด ----------
async function examCreditsWorkbook({ year } = {}) {
  const where = { isDeleted: false };
  if (year) where.examYear = year;

  const credits = await prisma.examCredit.findMany({
    where,
    orderBy: [{ examYear: 'desc' }, { sortOrder: 'asc' }],
  });

  const { wb, ws } = newWorkbook('รายชื่อสอบติด');
  ws.columns = [
    { header: 'ปีการศึกษา', key: 'year', width: 12 },
    { header: 'ชื่อจริง', key: 'realName', width: 28 },
    { header: 'นามแฝง', key: 'alias', width: 18 },
    { header: 'แสดงผลแบบ', key: 'display', width: 14 },
    { header: 'โรงเรียนที่สอบติด', key: 'school', width: 34 },
    { header: 'สนามสอบ', key: 'exam', width: 24 },
    { header: 'แสดงสาธารณะ', key: 'isPublic', width: 14 },
  ];
  for (const c of credits) {
    ws.addRow({
      year: c.examYear, realName: c.realName, alias: c.alias || '',
      display: c.displayType === 'REAL_NAME' ? 'ชื่อจริง' : 'นามแฝง',
      school: c.schoolName, exam: c.examName || '',
      isPublic: c.isPublic ? 'แสดง' : 'ซ่อน',
    });
  }
  styleHeader(ws);
  return wb;
}

module.exports = {
  salesWorkbook, studentsWorkbook, paymentsWorkbook,
  quizScoresWorkbook, examCreditsWorkbook,
};
