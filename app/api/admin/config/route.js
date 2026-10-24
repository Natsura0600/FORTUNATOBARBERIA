import { isAdmin, unauthorized } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/store";
import { handle, body } from "@/lib/api";
import { db } from "@/lib/db";
import { r2Enabled } from "@/lib/r2";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ config: await getConfig(), storage: db.kind, uploads: r2Enabled() });
});

export const PUT = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { config } = await body(req);
  return Response.json({ config: await saveConfig(config) });
});
