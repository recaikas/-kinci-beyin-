/** Ortak HTTP yardımcıları. */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export function serve(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    try {
      if (req.method !== "POST") throw new HttpError(405, "Yalnızca POST");
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, details: e.details ?? null }, e.status);
      console.error(e);
      return json({ error: "Beklenmeyen hata" }, 500);
    }
  });
}
