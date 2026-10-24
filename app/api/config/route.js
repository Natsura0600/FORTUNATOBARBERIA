import { getConfig, publicConfig } from "@/lib/store";
import { handle } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json(publicConfig(await getConfig())));
