import { isAdmin, unauthorized } from "@/lib/auth";
import { getConfig, availability } from "@/lib/store";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const p = new URL(req.url).searchParams;
  const cfg = await getConfig();
  const res = await availability(cfg, {
    date: p.get("date"), barberId: p.get("barberId"),
    duration: Number(p.get("duration")) || 30, ignoreRules: true,
  });
  return Response.json(res);
});
