import { getConfig, availability } from "@/lib/store";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  const p = new URL(req.url).searchParams;
  const cfg = await getConfig();
  const service = cfg.services.find((s) => s.id === p.get("serviceId") && s.active);
  if (!service) return Response.json({ slots: [], reason: "Elegí un servicio" });
  const res = await availability(cfg, { date: p.get("date"), barberId: p.get("barberId"), duration: service.duration });
  return Response.json(res);
});
