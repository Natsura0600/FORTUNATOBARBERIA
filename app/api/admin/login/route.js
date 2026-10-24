import { checkPassword, createSession, isAdmin } from "@/lib/auth";
import { body } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: await isAdmin() });
}

export async function POST(req) {
  const { password } = await body(req);
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }
  await createSession();
  return Response.json({ ok: true });
}
