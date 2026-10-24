import { isAdmin, unauthorized } from "@/lib/auth";
import { getConfig, setBarberPhoto } from "@/lib/store";
import { r2Enabled, putObject, deleteByUrl } from "@/lib/r2";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 4 * 1024 * 1024; // Vercel acepta hasta 4,5 MB por pedido; el panel achica la foto antes de mandarla

// Sube la foto de un barbero a R2 y la deja guardada en su ficha.
export const POST = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  if (!r2Enabled()) return Response.json({ error: "Falta configurar Cloudflare R2 (ver README)." }, { status: 501 });

  const form = await req.formData();
  const barberId = String(form.get("barberId") || "");
  const file = form.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "Elegí una imagen" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: "La foto tiene que ser JPG, PNG o WEBP" }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "La foto pesa más de 4 MB" }, { status: 400 });

  const cfg = await getConfig();
  const barber = cfg.barbers.find((b) => b.id === barberId);
  if (!barber) return Response.json({ error: "Guardá los cambios del barbero antes de subirle una foto" }, { status: 400 });

  const objectKey = `barberos/${barberId}-${Date.now().toString(36)}.${ext}`;
  const url = await putObject(objectKey, await file.arrayBuffer(), file.type);
  const previous = barber.photo;
  const config = await setBarberPhoto(barberId, url);
  await deleteByUrl(previous);
  return Response.json({ photo: url, config });
});

// Quita la foto (vuelve a mostrar las iniciales) y la borra del bucket.
export const DELETE = handle(async (req) => {
  if (!(await isAdmin())) return unauthorized();
  const { barberId } = await req.json().catch(() => ({}));
  const cfg = await getConfig();
  const barber = cfg.barbers.find((b) => b.id === barberId);
  if (!barber) return Response.json({ error: "Barbero no encontrado" }, { status: 400 });
  const config = await setBarberPhoto(barberId, "");
  if (r2Enabled()) await deleteByUrl(barber.photo);
  return Response.json({ photo: "", config });
});
