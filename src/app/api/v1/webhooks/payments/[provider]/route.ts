import { NextResponse } from "next/server";
import { handlePaymentWebhook } from "@/server/services/payments";

// Raw body is required for signature verification — do not parse JSON before verifying.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const raw = await req.text();
  const out = await handlePaymentWebhook((await params).provider, raw, req.headers);
  return NextResponse.json(out.body, { status: out.status });
}
