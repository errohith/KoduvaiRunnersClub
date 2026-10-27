import { verifyToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { recordConsent } from "@/server/services/notifications";
import { Alert } from "@/components/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

async function confirm(formData: FormData) {
  "use server";
  const t = verifyToken<{ e: string; c: string }>(String(formData.get("t") ?? ""));
  if (!t?.e) redirect("/unsubscribe?invalid=1");
  await recordConsent(prisma, { email: t.e, channel: "EMAIL_MARKETING", granted: false, source: "unsubscribe_link" });
  redirect("/unsubscribe?done=1");
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string; invalid?: string }> }) {
  const { t, done, invalid } = await searchParams;
  const token = t ? verifyToken<{ e: string }>(t) : null;
  return (
    <div className="container-page max-w-lg py-16">
      <div className="card space-y-4 p-8">
        <h1 className="text-3xl font-extrabold uppercase">Email preferences</h1>
        {done ? (
          <Alert tone="success" title="You're unsubscribed">You will no longer receive club announcements by email. Service messages about your registrations will still be sent.</Alert>
        ) : invalid || !token ? (
          <Alert tone="error">This unsubscribe link is invalid or has expired. Contact the club to update your preferences.</Alert>
        ) : (
          <form action={confirm} className="space-y-4">
            <input type="hidden" name="t" value={t} />
            <p>Stop receiving club news and announcements at <strong>{token.e}</strong>?</p>
            <button className="btn-primary">Unsubscribe</button>
          </form>
        )}
      </div>
    </div>
  );
}
