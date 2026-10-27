import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { renderTemplate, templateVariables } from "@/lib/template";
import { SAMPLE_VARS, textToHtml, wrapEmailHtml } from "@/server/services/notifications";
import { AdminPage, Check, Input, Panel, Textarea } from "@/components/admin/kit";
import { SubmitButton } from "@/components/admin/buttons";
import { saveTemplateAction, testTemplateAction } from "@/server/admin/comms-actions";
import { config } from "@/config/env";

export default async function TemplateEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requirePagePermission("templates.manage");
  const t = await prisma.notificationTemplate.findUnique({ where: { id: (await params).id } });
  if (!t) notFound();
  const vars = { clubName: "Koduvai Runners", appUrl: config.APP_URL, ...SAMPLE_VARS };
  const used = templateVariables(`${t.subject ?? ""} ${t.bodyText} ${t.bodyHtml ?? ""}`);
  const previewHtml = t.channel === "EMAIL" ? await wrapEmailHtml(t.bodyHtml ? renderTemplate(t.bodyHtml, vars, { html: true }) : textToHtml(renderTemplate(t.bodyText, vars))) : null;
  return (
    <AdminPage title={t.name} description={<><span className="font-mono">{t.key}</span> · {t.channel} · {t.category.toLowerCase()}</>} flash={await searchParams}>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Edit">
          <form action={saveTemplateAction} className="space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <Input name="name" label="Name" defaultValue={t.name} />
            {t.channel === "EMAIL" && <Input name="subject" label="Subject" defaultValue={t.subject} />}
            <Textarea name="bodyText" label={t.channel === "EMAIL" ? "Plain-text body" : "Message text (reference copy of the approved template)"} defaultValue={t.bodyText} rows={10} />
            {t.channel === "EMAIL" && <Textarea name="bodyHtml" label="HTML body (optional)" defaultValue={t.bodyHtml} rows={6} mono help="Blank = auto-format the plain text. Variables are HTML-escaped." />}
            {t.channel === "WHATSAPP" && (
              <>
                {t.description && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{t.description}</p>}
                <Input name="whatsappTemplateName" label="Approved template name" defaultValue={t.whatsappTemplateName} help="Exactly as approved in WhatsApp Manager. Blank = WhatsApp sends are skipped." />
                <Input name="whatsappLanguage" label="Language code" defaultValue={t.whatsappLanguage ?? "en"} />
                <Input name="whatsappParams" label="Variables in order ({{1}}, {{2}}, …)" defaultValue={t.whatsappParams.join(", ")} />
              </>
            )}
            <Check name="isActive" label="Active" defaultChecked={t.isActive} />
            <SubmitButton className="btn-primary btn-sm">Save template</SubmitButton>
          </form>
          <p className="mt-4 text-xs text-slate-500">Variables available: {Object.keys(vars).map((v) => `{{${v}}}`).join(" ")}. Used here: {used.join(", ") || "none"}.</p>
        </Panel>
        <div className="space-y-6">
          <Panel title="Preview (sample data)">
            {t.channel === "EMAIL" ? (
              <>
                <p className="mb-2 text-sm"><span className="text-slate-500">Subject:</span> {renderTemplate(t.subject ?? "", vars)}</p>
                <iframe title="Email preview" sandbox="" srcDoc={previewHtml!} className="h-[480px] w-full rounded-lg border border-slate-200 bg-white" />
              </>
            ) : (
              <pre className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-4 font-sans text-sm">{renderTemplate(t.bodyText, vars)}</pre>
            )}
          </Panel>
          <Panel title="Send a test">
            <form action={testTemplateAction} className="space-y-2">
              <input type="hidden" name="id" value={t.id} />
              {t.channel === "EMAIL" ? <input name="testEmail" type="email" defaultValue={user.email} className="input" aria-label="Test email" /> : <input name="testPhone" className="input" placeholder="+91…" aria-label="Test WhatsApp number" />}
              <SubmitButton className="btn-outline btn-sm">Send test with sample data</SubmitButton>
              <p className="help">The result shows the provider response. With the channel disabled the message is recorded as skipped.</p>
            </form>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
