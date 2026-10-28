import { isAdmin, unauthorized } from "@/lib/auth";
import { listClients, getClient, saveClient, deleteClient, importClients } from "@/lib/clients";
import { handle, body } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const key = new URL(req.url).searchParams.get("key");
  if (key) return Response.json({ client: await getClient(key) });
  return Response.json({ clients: await listClients() });
});

// action "preview": muestra qué se va a importar. action "import": lo guarda.
export const POST = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { action, csv } = await body(req);
  return Response.json({ result: await importClients(csv, { dryRun: action !== "import" }) });
});

export const PUT = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  return Response.json({ client: await saveClient(await body(req)) });
});

export const DELETE = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { key } = await body(req);
  await deleteClient(key);
  return Response.json({ ok: true });
});
