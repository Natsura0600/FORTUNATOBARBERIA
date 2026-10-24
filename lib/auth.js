import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "fortunato_admin";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

const secret = () => process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "cambiar-esto";

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkPassword(input) {
  // En producción sin ADMIN_PASSWORD el panel queda cerrado (nunca se usa la clave de prueba).
  if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === "production") return false;
  const expected = process.env.ADMIN_PASSWORD || "fortunato";
  const a = Buffer.from(String(input || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `admin.${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf(".");
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const exp = Number(payload.split(".")[1]);
  return exp > Date.now();
}

export function unauthorized() {
  return Response.json({ error: "No autorizado" }, { status: 401 });
}
