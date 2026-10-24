import { getConfig, cancelByClient } from "@/lib/store";
import { handle, body } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const cfg = await getConfig();
  await cancelByClient(cfg, await body(req));
  return Response.json({ ok: true });
});
