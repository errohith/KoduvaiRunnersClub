import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getPage, section, type SectionItem } from "@/server/services/content";
import { getSettings } from "@/server/services/settings";
import { PlanCard } from "@/components/cards";
import { Alert, PageHeader, SectionHeading } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPage("membership");
  return { title: p?.title ?? "Membership", description: p?.metaDescription ?? undefined };
}

export default async function MembershipPage() {
  const [page, plans, settings] = await Promise.all([getPage("membership"), prisma.membershipPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }), getSettings()]);
  const intro = section(page, "intro");
  const faq = section(page, "faq");
  const featured = plans.find((p) => p.code === "GENERAL")?.id;
  return (
    <>
      <PageHeader eyebrow="Membership" title={intro?.title ?? "Membership"} subtitle={intro?.subtitle} />
      <div className="container-page py-14">
        {!settings.membership.applicationsOpen && <Alert tone="warning" title="Applications are currently closed">Please check back soon or contact the club.</Alert>}
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} featured={p.id === featured} />
          ))}
        </div>

        <section className="mt-16">
          <SectionHeading eyebrow="At a glance" title="Compare memberships" />
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="table min-w-[560px]">
              <caption className="sr-only">Membership types and fees</caption>
              <thead>
                <tr><th scope="col">Membership</th><th scope="col">Fee</th><th scope="col">Type</th><th scope="col">Eligibility</th></tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <th scope="row" className="px-3 py-2.5 font-semibold text-brand-ink">{p.name}</th>
                    <td>{p.feeMinor === 0 ? "Free" : formatMoney(p.feeMinor, p.currency)}</td>
                    <td>{p.feeMinor === 0 ? "Free" : "Paid"}</td>
                    <td className="text-slate-600">{p.eligibility ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 grid gap-10 lg:grid-cols-3">
          <div>
            <SectionHeading eyebrow="How it works" title="Joining in 3 steps" />
            <ol className="mt-6 space-y-4">
              {["Choose a membership and complete the online form.", "A committee member reviews your application.", "Pay the fee (if any) and your membership is activated."].map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
                  <span className="pt-1 text-slate-700">{s}</span>
                </li>
              ))}
            </ol>
            <Link href="/join" className="btn-primary mt-6">Start your application</Link>
          </div>
          {faq && (
            <div className="lg:col-span-2">
              <SectionHeading eyebrow="Questions" title={faq.title ?? "FAQs"} />
              <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                {(faq.items as SectionItem[]).map((q) => (
                  <details key={q.label} className="group p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-brand-ink">
                      {q.label}
                      <span aria-hidden className="text-brand transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-slate-600">{q.detail ?? q.value}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
