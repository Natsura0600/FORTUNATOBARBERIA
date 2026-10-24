import { isAdmin, unauthorized } from "@/lib/auth";
import { getConfig, getBookings, createBooking, updateBooking } from "@/lib/store";
import { handle, body } from "@/lib/api";
import { isYMD } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const date = new URL(req.url).searchParams.get("date");
  if (!isYMD(date)) return Response.json({ error: "Fecha inválida" }, { status: 400 });
  return Response.json({ bookings: await getBookings(date) });
});

export const POST = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const cfg = await getConfig();
  const booking = await createBooking(cfg, await body(req), { admin: true });
  return Response.json({ booking });
});

export const PATCH = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { date, id, ...patch } = await body(req);
  const booking = await updateBooking(date, id, patch);
  return Response.json({ booking });
});
