import { isAdmin, unauthorized } from "@/lib/auth";
import { exportAll, restoreAll } from "@/lib/backup";
import { handle, body } from "@/lib/api";
import { nowParts } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Descarga la copia completa como archivo .json
export const GET = handle(async () => {
  if (!(await isAdmin())) return unauthorized();
  const data = await exportAll();
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="copia-fortunato-${nowParts().date}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

// Restaura una copia descargada antes.
export const POST = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { backup } = await body(req);
  return Response.json({ done: await restoreAll(backup) });
});
