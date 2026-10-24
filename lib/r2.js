// Cloudflare R2 (API compatible con S3) para las fotos de los barberos.
// La subida pasa por el servidor: no hace falta configurar CORS en el bucket.
import { AwsClient } from "aws4fetch";

const env = () => ({
  account: process.env.R2_ACCOUNT_ID,
  key: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicUrl: (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
  // Opcional: para buckets con jurisdicción UE (https://<cuenta>.eu.r2.cloudflarestorage.com)
  endpoint: (process.env.R2_ENDPOINT || "").replace(/\/+$/, ""),
});

export function r2Enabled() {
  const e = env();
  return !!(e.account && e.key && e.secret && e.bucket && e.publicUrl);
}

function client() {
  const e = env();
  return {
    e,
    aws: new AwsClient({ accessKeyId: e.key, secretAccessKey: e.secret, service: "s3", region: "auto" }),
    base: `${e.endpoint || `https://${e.account}.r2.cloudflarestorage.com`}/${e.bucket}`,
  };
}

export async function putObject(objectKey, body, contentType) {
  const { e, aws, base } = client();
  const buf = new Uint8Array(body);
  // Se firma el pedido y se envía con el buffer original: así sale con Content-Length,
  // que R2 exige en los PUT (un body en stream iría "chunked" y lo rechaza).
  const signed = await aws.sign(`${base}/${objectKey}`, {
    method: "PUT",
    body: buf,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: buf });
  if (!res.ok) throw new Error(`R2 respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${e.publicUrl}/${objectKey}`;
}

// Borra un archivo solo si es nuestro (está bajo la URL pública del bucket).
export async function deleteByUrl(url) {
  const { e, aws, base } = client();
  if (!url || !url.startsWith(`${e.publicUrl}/`)) return;
  const objectKey = url.slice(e.publicUrl.length + 1);
  try { await aws.fetch(`${base}/${objectKey}`, { method: "DELETE" }); } catch {}
}
