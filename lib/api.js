import { BookingError } from "./store";

// Envuelve un handler y traduce errores conocidos a respuestas JSON.
export function handle(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof BookingError) return Response.json({ error: e.message }, { status: 400 });
      console.error(e);
      return Response.json({ error: "Error del servidor" }, { status: 500 });
    }
  };
}

export async function body(req) {
  try { return await req.json(); } catch { return {}; }
}
