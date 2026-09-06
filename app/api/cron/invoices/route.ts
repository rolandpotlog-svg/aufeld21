import { POST as generateInvoices } from "@/app/api/admin/invoices/generate/route";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  return generateInvoices(
    new Request(new URL("/api/admin/invoices/generate", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({}),
    }),
  );
}
