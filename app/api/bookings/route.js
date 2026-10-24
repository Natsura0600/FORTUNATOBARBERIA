import { getConfig, createBooking } from "@/lib/store";
import { handle, body } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const data = await body(req);
  if (data.website) return Response.json({ error: "Solicitud inválida" }, { status: 400 }); // honeypot anti-bots
  const cfg = await getConfig();
  const b = await createBooking(cfg, data);
  return Response.json({
    booking: {
      code: b.code, date: b.date, time: b.time, duration: b.duration,
      barberName: b.barberName, serviceName: b.serviceName, price: b.price, name: b.name,
    },
  });
});
