import { isAdmin, unauthorized } from "@/lib/auth";
import { getConfig, cashReport, addMovement, deleteMovement } from "@/lib/store";
import { handle, body } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const p = new URL(req.url).searchParams;
  const cfg = await getConfig();
  return Response.json({ report: await cashReport(cfg, p.get("from"), p.get("to")) });
});

export const POST = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ movement: await addMovement(await body(req)) });
});

export const DELETE = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { date, id } = await body(req);
  await deleteMovement(date, id);
  return Response.json({ ok: true });
});
