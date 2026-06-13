const path = require('path');
const PDFDocument = require('pdfkit');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const FONT_REGULAR = path.join(__dirname, '../assets/fonts/Sarabun-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../assets/fonts/Sarabun-Bold.ttf');

const BRAND = '#f97316';
const INK = '#0b1220';
const MUTED = '#64748b';

function thaiDate(d) {
  return new Date(d).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
  });
}
function baht(n) {
  return `${Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
}

function newDoc(options = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, ...options });
  doc.registerFont('thai', FONT_REGULAR);
  doc.registerFont('thai-bold', FONT_BOLD);
  return doc;
}

// ============ ใบเสร็จ ============
async function buildReceipt(orderId, { requesterId, isAdmin }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
      items: true,
      payments: { where: { status: 'SUCCESS' }, take: 1 },
    },
  });
  if (!order) throw ApiError.notFound('Order ไม่พบ');
  if (!isAdmin && order.user.id !== requesterId) throw ApiError.forbidden();
  if (order.status !== 'PAID') throw ApiError.badRequest('ออกใบเสร็จได้เฉพาะ order ที่ชำระแล้ว');

  const doc = newDoc();

  // header
  doc.rect(0, 0, doc.page.width, 110).fill('#fff7ed');
  doc.fill(BRAND).font('thai-bold').fontSize(26).text('HighBrainnet', 50, 36);
  doc.fill(MUTED).font('thai').fontSize(11)
    .text('ระบบคลาสออนไลน์คณิตศาสตร์ — หาดใหญ่ สงขลา', 50, 70);
  doc.fill(INK).font('thai-bold').fontSize(20)
    .text('ใบเสร็จรับเงิน', 0, 46, { align: 'right', width: doc.page.width - 50 });

  let y = 140;
  doc.font('thai').fontSize(11).fill(MUTED);
  doc.text('เลขที่:', 50, y);     doc.fill(INK).font('thai-bold').text(order.orderNumber, 130, y);
  y += 20;
  doc.fill(MUTED).font('thai').text('วันที่ชำระ:', 50, y);
  doc.fill(INK).text(thaiDate(order.payments[0]?.paidAt || order.updatedAt), 130, y);
  y += 20;
  doc.fill(MUTED).text('ผู้ชำระ:', 50, y);
  doc.fill(INK).text(`${order.user.fullName} (${order.user.email})`, 130, y);
  y += 20;
  doc.fill(MUTED).text('ช่องทาง:', 50, y);
  doc.fill(INK).text(order.paymentMethod === 'MANUAL' ? 'โอนเงิน (ตรวจสอบโดยแอดมิน)' : 'QR PromptPay (GB Prime Pay)', 130, y);

  // items table
  y += 40;
  doc.rect(50, y, doc.page.width - 100, 26).fill('#f1f5f9');
  doc.fill(INK).font('thai-bold').fontSize(11);
  doc.text('รายการ', 60, y + 6);
  doc.text('จำนวนเงิน', doc.page.width - 170, y + 6, { width: 110, align: 'right' });
  y += 26;

  doc.font('thai').fontSize(11);
  for (const item of order.items) {
    doc.fill(INK).text(item.title, 60, y + 6, { width: doc.page.width - 250 });
    doc.text(baht(item.amount), doc.page.width - 170, y + 6, { width: 110, align: 'right' });
    const h = Math.max(26, doc.heightOfString(item.title, { width: doc.page.width - 250 }) + 12);
    y += h;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#e6eaf0').stroke();
  }

  y += 10;
  doc.font('thai-bold').fontSize(13).fill(INK);
  doc.text('ยอดรวมสุทธิ', 60, y);
  doc.fill(BRAND).text(baht(order.amount), doc.page.width - 220, y, { width: 160, align: 'right' });

  y += 60;
  doc.font('thai').fontSize(10).fill(MUTED)
    .text('ใบเสร็จนี้ออกโดยระบบอัตโนมัติ — HighBrainnet', 50, y, { align: 'center', width: doc.page.width - 100 });

  doc.end();
  return { doc, filename: `receipt-${order.orderNumber}.pdf` };
}

// ============ ใบเซอร์ติฟิเกต ============
async function buildCertificate(certificateId, { requesterId, isAdmin }) {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: {
      user: { select: { id: true, fullName: true } },
      course: { select: { title: true, level: { select: { name: true } } } },
    },
  });
  if (!cert) throw ApiError.notFound('Certificate ไม่พบ');
  if (!isAdmin && cert.user.id !== requesterId) throw ApiError.forbidden();

  const doc = newDoc({ layout: 'landscape', margin: 0 });
  const W = doc.page.width;   // 842
  const H = doc.page.height;  // 595

  // background + border
  doc.rect(0, 0, W, H).fill('#fffdf9');
  doc.lineWidth(3).rect(24, 24, W - 48, H - 48).strokeColor(BRAND).stroke();
  doc.lineWidth(1).rect(32, 32, W - 64, H - 64).strokeColor('#fdba74').stroke();

  doc.fill(BRAND).font('thai-bold').fontSize(30).text('HighBrainnet', 0, 70, { align: 'center' });
  doc.fill(MUTED).font('thai').fontSize(13)
    .text('ระบบคลาสออนไลน์คณิตศาสตร์', 0, 108, { align: 'center' });

  doc.fill(INK).font('thai-bold').fontSize(24)
    .text('ใบประกาศนียบัตร', 0, 160, { align: 'center' });
  doc.font('thai').fontSize(14).fill(MUTED)
    .text('มอบให้ไว้เพื่อแสดงว่า', 0, 200, { align: 'center' });

  doc.fill(INK).font('thai-bold').fontSize(30)
    .text(cert.user.fullName, 0, 235, { align: 'center' });

  doc.font('thai').fontSize(14).fill(MUTED)
    .text('ได้สำเร็จการศึกษาหลักสูตร', 0, 290, { align: 'center' });
  doc.fill(INK).font('thai-bold').fontSize(20)
    .text(cert.course.title, 60, 320, { align: 'center', width: W - 120 });
  doc.font('thai').fontSize(12).fill(MUTED)
    .text(`ระดับ ${cert.course.level.name}`, 0, 360, { align: 'center' });

  doc.font('thai').fontSize(12).fill(INK)
    .text(`ออกให้เมื่อวันที่ ${thaiDate(cert.issuedAt)}`, 0, 420, { align: 'center' });

  // signature line
  doc.moveTo(W / 2 - 110, 500).lineTo(W / 2 + 110, 500).strokeColor(INK).stroke();
  doc.font('thai').fontSize(12).text('ครูผู้สอน — HighBrainnet', 0, 508, { align: 'center' });

  doc.font('thai').fontSize(9).fill(MUTED)
    .text(`รหัสตรวจสอบ: ${cert.certificateCode}`, 0, H - 52, { align: 'center' });

  doc.end();
  return { doc, filename: `certificate-${cert.certificateCode}.pdf` };
}

module.exports = { buildReceipt, buildCertificate };
