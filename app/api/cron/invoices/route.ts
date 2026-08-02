import { addMonths, format, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { POST as generateInvoices } from "@/app/api/admin/invoices/generate/route";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const billingMonth = format(addMonths(startOfMonth(toZonedTime(new Date(), "Europe/Vienna")), 1), "yyyy-MM-01");
  return generateInvoices(
    new Request(new URL("/api/admin/invoices/generate", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ billingMonth }),
    }),
  );
}
