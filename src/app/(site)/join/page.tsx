import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSettings } from "@/server/services/settings";
import { formatMoney } from "@/lib/money";
import { MembershipForm } from "@/components/forms/MembershipForm";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Join the Club", description: "Apply for membership online." };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const [plans, settings] = await Promise.all([prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }), getSettings()]);
  return (
    <>
      <PageHeader eyebrow="Membership application" title="Join the club" subtitle="It takes about two minutes. We'll email you a reference number straight away." />
      <div className="container-page max-w-3xl py-12">
        {!settings.membership.applicationsOpen ? (
          <Alert tone="warning" title="Applications are currently closed">Please check back soon or <Link href="/contact" className="underline">contact the club</Link>.</Alert>
        ) : (
          <MembershipForm
            initialPlan={plan}
            requireDob={settings.membership.requireDateOfBirth}
            requireEmergency={settings.membership.requireEmergencyContact}
            plans={plans.map((p) => ({ id: p.id, code: p.code, name: p.name, description: p.description, free: p.feeMinor === 0, feeLabel: formatMoney(p.feeMinor, p.currency), requiresStudentVerification: p.requiresStudentVerification }))}
          />
        )}
        <p className="mt-8 text-center text-sm text-slate-600">
          Already applied? <Link href="/join/status" className="font-semibold text-brand hover:underline">Check your application status</Link>
        </p>
      </div>
    </>
  );
}
