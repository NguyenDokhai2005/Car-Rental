import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const ZONE = "Asia/Ho_Chi_Minh";

export type OverviewDay = {
  date: string;
  newUsers: number;
  newVehicles: number;
  bookingsCreated: number;
  bookingsPaid: number;
  bookingsCompleted: number;
  paidAmount: number;
};

export type Overview = {
  days: number;
  queues: { pendingVehicles: number; pendingLicenses: number; awaitingOwnerApproval: number; inUse: number };
  totals: {
    users: Record<string, number>;
    vehicles: Record<string, number>;
    bookings: number;
    paidAmount: number;
    refundAmount: number;
    ownerPayoutAmount: number;
    heldAmount: number;
  };
  series: OverviewDay[];
  performance: {
    created: number;
    paid: number;
    approved: number;
    completed: number;
    cancelled: number;
    rejected: number;
    expired: number;
    avgOwnerResponseHours: number | null;
    avgVehicleReviewHours: number | null;
    avgBookingValue: number | null;
    avgRentalDays: number | null;
    utilizationPercent: number | null;
    topCities: { city: string; bookings: number; paidAmount: number }[];
  };
};

const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

// 00:00 giờ Việt Nam của ngày đầu tiên trong khoảng `days` ngày tính đến hôm nay.
export function windowStart(days: number, now: Date): Date {
  const vietnamMidnight = Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
  return new Date(vietnamMidnight - (days - 1) * DAY_MS);
}

// Số liệu tổng quan cho admin (SPEC §7). Chỉ đọc, gom nhóm ngay trong CSDL: mỗi chỉ số một lượt quét có điều kiện thời gian,
// không kéo từng dòng về API.
@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get(days: number, now: Date = new Date()): Promise<Overview> {
    const start = windowStart(days, now);
    const [queues, totals, series, performance] = await Promise.all([
      this.queues(now),
      this.totals(),
      this.series(start, now),
      this.performance(start, now),
    ]);
    return { days, queues, totals, series, performance };
  }

  private async queues(now: Date): Promise<Overview["queues"]> {
    const [pendingVehicles, pendingLicenses, awaitingOwnerApproval, inUse] = await Promise.all([
      this.prisma.vehicle.count({ where: { status: "pending" } }),
      this.prisma.user.count({ where: { licenseStatus: "pending" } }),
      this.prisma.booking.count({ where: { status: "pending", paidAt: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] } }),
      this.prisma.booking.count({ where: { status: "in_use" } }),
    ]);
    return { pendingVehicles, pendingLicenses, awaitingOwnerApproval, inUse };
  }

  private async totals(): Promise<Overview["totals"]> {
    const [users, vehicles, bookings, money] = await Promise.all([
      this.prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      this.prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.booking.count(),
      this.prisma.booking.aggregate({ _sum: { paidAmount: true, refundAmount: true, ownerPayoutAmount: true } }),
    ]);
    const paidAmount = money._sum.paidAmount ?? 0;
    const refundAmount = money._sum.refundAmount ?? 0;
    const ownerPayoutAmount = money._sum.ownerPayoutAmount ?? 0;
    return {
      users: Object.fromEntries(users.map((row) => [row.role, row._count._all])),
      vehicles: Object.fromEntries(vehicles.map((row) => [row.status, row._count._all])),
      bookings,
      paidAmount,
      refundAmount,
      ownerPayoutAmount,
      heldAmount: paidAmount - refundAmount - ownerPayoutAmount,
    };
  }

  // Mỗi ngày (theo giờ Việt Nam) một dòng, kể cả ngày không có gì: biểu đồ không bị thiếu điểm.
  private series(start: Date, now: Date): Promise<OverviewDay[]> {
    return this.prisma.$queryRaw<OverviewDay[]>`
      WITH days AS (
        SELECT generate_series((${start}::timestamptz AT TIME ZONE ${ZONE})::date, (${now}::timestamptz AT TIME ZONE ${ZONE})::date, interval '1 day')::date AS day
      ),
      u AS (SELECT (created_at AT TIME ZONE ${ZONE})::date AS day, count(*) AS n FROM users WHERE created_at >= ${start} GROUP BY 1),
      v AS (SELECT (created_at AT TIME ZONE ${ZONE})::date AS day, count(*) AS n FROM vehicles WHERE created_at >= ${start} GROUP BY 1),
      bc AS (SELECT (created_at AT TIME ZONE ${ZONE})::date AS day, count(*) AS n FROM bookings WHERE created_at >= ${start} GROUP BY 1),
      bp AS (SELECT (paid_at AT TIME ZONE ${ZONE})::date AS day, count(*) AS n, sum(paid_amount) AS amount FROM bookings WHERE paid_at >= ${start} GROUP BY 1),
      bd AS (SELECT (completed_at AT TIME ZONE ${ZONE})::date AS day, count(*) AS n FROM bookings WHERE completed_at >= ${start} GROUP BY 1)
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
        coalesce(u.n, 0)::int AS "newUsers",
        coalesce(v.n, 0)::int AS "newVehicles",
        coalesce(bc.n, 0)::int AS "bookingsCreated",
        coalesce(bp.n, 0)::int AS "bookingsPaid",
        coalesce(bd.n, 0)::int AS "bookingsCompleted",
        coalesce(bp.amount, 0)::float8 AS "paidAmount"
      FROM days
      LEFT JOIN u USING (day) LEFT JOIN v USING (day) LEFT JOIN bc USING (day) LEFT JOIN bp USING (day) LEFT JOIN bd USING (day)
      ORDER BY days.day`;
  }

  private async performance(start: Date, now: Date): Promise<Overview["performance"]> {
    type Funnel = {
      created: number; paid: number; approved: number; completed: number; cancelled: number; rejected: number; expired: number;
      owner_hours: number | null; booking_value: number | null; rental_days: number | null;
    };
    const [[funnel], [review], [usage], approvedVehicles, topCities] = await Promise.all([
      this.prisma.$queryRaw<Funnel[]>`
        SELECT count(*)::int AS created,
          count(*) FILTER (WHERE paid_at IS NOT NULL)::int AS paid,
          count(*) FILTER (WHERE owner_approved_at IS NOT NULL)::int AS approved,
          count(*) FILTER (WHERE status = 'completed')::int AS completed,
          count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
          count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          count(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at < ${now}))::int AS expired,
          (avg(extract(epoch FROM owner_approved_at - paid_at) / 3600) FILTER (WHERE owner_approved_at IS NOT NULL AND paid_at IS NOT NULL))::float8 AS owner_hours,
          (avg(total_amount) FILTER (WHERE paid_at IS NOT NULL))::float8 AS booking_value,
          (avg(rental_days) FILTER (WHERE paid_at IS NOT NULL))::float8 AS rental_days
        FROM bookings WHERE created_at >= ${start}`,
      this.prisma.$queryRaw<{ hours: number | null }[]>`
        SELECT (avg(extract(epoch FROM reviewed_at - created_at) / 3600))::float8 AS hours
        FROM vehicles WHERE status = 'approved' AND reviewed_at >= ${start}`,
      // Số ngày-xe thật sự có khách thuê trong khoảng: phần giao nhau giữa thời gian thuê và khoảng đang xét.
      this.prisma.$queryRaw<{ rented_days: number }[]>`
        SELECT coalesce(sum(extract(epoch FROM least(end_at, ${now}) - greatest(start_at, ${start})) / 86400), 0)::float8 AS rented_days
        FROM bookings WHERE status IN ('in_use', 'completed') AND start_at < ${now} AND end_at > ${start}`,
      this.prisma.vehicle.count({ where: { status: "approved" } }),
      this.prisma.$queryRaw<{ city: string; bookings: number; paidAmount: number }[]>`
        SELECT v.city, count(*)::int AS bookings, coalesce(sum(b.paid_amount), 0)::float8 AS "paidAmount"
        FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id
        WHERE b.created_at >= ${start}
        GROUP BY v.city ORDER BY count(*) DESC, v.city LIMIT 5`,
    ]);

    const availableDays = approvedVehicles * ((now.getTime() - start.getTime()) / DAY_MS);
    return {
      created: funnel.created,
      paid: funnel.paid,
      approved: funnel.approved,
      completed: funnel.completed,
      cancelled: funnel.cancelled,
      rejected: funnel.rejected,
      expired: funnel.expired,
      avgOwnerResponseHours: round1(funnel.owner_hours),
      avgVehicleReviewHours: round1(review.hours),
      avgBookingValue: funnel.booking_value === null ? null : Math.round(funnel.booking_value),
      avgRentalDays: round1(funnel.rental_days),
      utilizationPercent: availableDays > 0 ? round1(Math.min(100, (usage.rented_days / availableDays) * 100)) : null,
      topCities,
    };
  }
}
