const prisma = require('../config/prisma');

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function nDaysAgo(n) {
  const x = startOfDay();
  x.setDate(x.getDate() - n + 1); // include today → window of n days
  return x;
}

async function sumPaidOrders(since) {
  const r = await prisma.order.aggregate({
    where: { status: 'PAID', isDeleted: false, updatedAt: { gte: since } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return {
    revenue: Number(r._sum.amount || 0),
    orders: r._count._all,
  };
}

async function summary() {
  const today = startOfDay();
  const month = startOfMonth();
  const epoch = new Date(0);

  const [todayStats, monthStats, totalStats,
    newStudentsToday, newStudentsMonth, totalStudents,
    pendingApprovals, awaitingPayment, totalCourses] = await Promise.all([
    sumPaidOrders(today),
    sumPaidOrders(month),
    sumPaidOrders(epoch),
    prisma.user.count({ where: { role: 'STUDENT', isDeleted: false, createdAt: { gte: today } } }),
    prisma.user.count({ where: { role: 'STUDENT', isDeleted: false, createdAt: { gte: month } } }),
    prisma.user.count({ where: { role: 'STUDENT', isDeleted: false } }),
    prisma.order.count({ where: { status: 'PENDING', paymentMethod: 'MANUAL', isDeleted: false } }),
    prisma.order.count({ where: { status: 'AWAITING_PAYMENT', isDeleted: false } }),
    prisma.course.count({ where: { isDeleted: false } }),
  ]);

  return {
    sales: { today: todayStats, month: monthStats, allTime: totalStats },
    students: {
      newToday: newStudentsToday,
      newThisMonth: newStudentsMonth,
      total: totalStudents,
    },
    pending: {
      manualApprovals: pendingApprovals,
      awaitingPayment,
    },
    catalog: {
      courses: totalCourses,
    },
  };
}

async function salesChart(days = 30) {
  const since = nDaysAgo(days);

  // Daily sum of PAID orders, grouped by date_trunc('day', updated_at)
  const rows = await prisma.$queryRaw`
    SELECT
      date_trunc('day', updated_at AT TIME ZONE 'Asia/Bangkok')::date AS day,
      COALESCE(SUM(amount), 0)::float AS revenue,
      COUNT(*)::int AS orders
    FROM orders
    WHERE status = 'PAID'
      AND is_deleted = false
      AND updated_at >= ${since}
    GROUP BY day
    ORDER BY day ASC;
  `;

  // Fill in missing days with zeros
  const map = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
  const series = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const r = map.get(key);
    series.push({
      day: key,
      revenue: r ? Number(r.revenue) : 0,
      orders: r ? Number(r.orders) : 0,
    });
  }

  return { days, since: since.toISOString(), series };
}

async function topCourses({ days = 30, limit = 3 } = {}) {
  const since = nDaysAgo(days);

  const rows = await prisma.$queryRaw`
    SELECT
      c.id          AS course_id,
      c.slug,
      c.title,
      COUNT(e.id)::int AS enrollments,
      COALESCE(SUM(oi.amount), 0)::float AS revenue
    FROM enrollments e
    JOIN courses c       ON c.id = e."course_id"
    LEFT JOIN order_items oi ON oi."order_id" = e."order_id" AND oi."course_id" = c.id
    WHERE e."enrolled_at" >= ${since}
      AND e.is_deleted = false
      AND c.is_deleted = false
    GROUP BY c.id, c.slug, c.title
    ORDER BY enrollments DESC, revenue DESC
    LIMIT ${limit};
  `;

  return rows.map((r) => ({
    courseId: r.course_id,
    slug: r.slug,
    title: r.title,
    enrollments: Number(r.enrollments),
    revenue: Number(r.revenue),
  }));
}

module.exports = { summary, salesChart, topCourses };
