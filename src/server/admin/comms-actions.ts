"use server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { parseLocalDateTime } from "@/lib/time";
import { campaignSchema } from "@/validation/schemas";
import { cancelCampaign, createCampaign, retryFailed, scheduleCampaign, testSendCampaign } from "@/server/services/campaigns";
import { SAMPLE_VARS, testSendTemplate } from "@/server/services/notifications";
import { optStr, runAdminAction, str } from "./run";

function testRecipient(fd: FormData) {
  const email = optStr(fd, "testEmail") ?? undefined;
  const phoneRaw = optStr(fd, "testPhone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) ?? undefined : undefined;
  if (phoneRaw && !phone) throw badRequest("Test phone number is invalid.");
  if (!email && !phone) throw badRequest("Enter a test email and/or phone number.");
  return { email, phone };
}

const summarize = (ds: { channel: string; status: string; lastError: string | null }[]) =>
  ds.map((d) => `${d.channel}: ${d.status}${d.lastError ? ` (${d.lastError})` : ""}`).join(" · ") || "Nothing to send for the given recipient.";

export async function createCampaignAction(fd: FormData) {
  return runAdminAction("comms.send", "/admin/announcements/new", async ({ user }) => {
    const audienceType = str(fd, "audienceType");
    const input = campaignSchema.parse({
      title: str(fd, "title"),
      subject: optStr(fd, "subject") ?? undefined,
      bodyText: str(fd, "bodyText"),
      bodyHtml: optStr(fd, "bodyHtml") ?? undefined,
      whatsappTemplateName: optStr(fd, "whatsappTemplateName") ?? undefined,
      whatsappLanguage: optStr(fd, "whatsappLanguage") ?? undefined,
      channels: fd.getAll("channels").map(String),
      category: str(fd, "category"),
      audience: { type: audienceType, ...(audienceType === "PLAN" ? { planId: str(fd, "planId") } : {}), ...(audienceType.startsWith("EVENT_") ? { eventId: str(fd, "eventId") } : {}) },
    });
    const c = await createCampaign(input, user.id);
    return { message: "Draft saved. Review the audience, send a test, then schedule or send.", redirectTo: `/admin/announcements/${c.id}` };
  });
}

export async function scheduleCampaignAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("comms.send", `/admin/announcements/${id}`, async ({ user }) => {
    const when = str(fd, "mode") === "schedule" ? parseLocalDateTime(str(fd, "scheduledAt")) : null;
    if (when && when < new Date()) throw badRequest("Choose a time in the future.");
    await scheduleCampaign(id, when, user.id);
    return when ? "Announcement scheduled." : "Announcement queued — the worker is sending it now.";
  });
}

export async function cancelCampaignAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("comms.send", `/admin/announcements/${id}`, async ({ user }) => {
    await cancelCampaign(id, user.id);
    return "Announcement cancelled. Messages already sent cannot be recalled.";
  });
}

export async function retryCampaignAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("comms.send", `/admin/announcements/${id}`, async ({ user }) => `${await retryFailed(id, user.id)} failed deliveries re-queued.`);
}

export async function testCampaignAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("comms.send", `/admin/announcements/${id}`, async () => `Test result — ${summarize(await testSendCampaign(id, testRecipient(fd)))}`);
}

export async function saveTemplateAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("templates.manage", `/admin/templates/${id}`, async ({ user }) => {
    const bodyText = str(fd, "bodyText");
    if (!bodyText) throw badRequest("Message text is required.");
    const t = await prisma.notificationTemplate.findUniqueOrThrow({ where: { id } });
    await prisma.notificationTemplate.update({
      where: { id },
      data: {
        name: str(fd, "name") || t.name,
        subject: t.channel === "EMAIL" ? optStr(fd, "subject") : null,
        bodyText,
        bodyHtml: t.channel === "EMAIL" ? optStr(fd, "bodyHtml") : null,
        whatsappTemplateName: t.channel === "WHATSAPP" ? optStr(fd, "whatsappTemplateName") : null,
        whatsappLanguage: t.channel === "WHATSAPP" ? optStr(fd, "whatsappLanguage") ?? "en" : null,
        whatsappParams: t.channel === "WHATSAPP" ? str(fd, "whatsappParams").split(",").map((s) => s.trim()).filter(Boolean) : [],
        isActive: fd.get("isActive") === "on",
      },
    });
    await audit({ actorId: user.id, action: "template.updated", entityType: "notification_template", entityId: id, metadata: { key: t.key, channel: t.channel } });
    return "Template saved.";
  });
}

export async function testTemplateAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("templates.manage", `/admin/templates/${id}`, async () => `Test result — ${summarize(await testSendTemplate(id, testRecipient(fd), SAMPLE_VARS))}`);
}

export async function contactStatusAction(fd: FormData) {
  return runAdminAction("contact.view", "/admin/messages", async ({ user }) => {
    const status = str(fd, "status") as "NEW" | "READ" | "ARCHIVED";
    if (!["NEW", "READ", "ARCHIVED"].includes(status)) throw badRequest("Invalid status");
    await prisma.contactMessage.update({ where: { id: str(fd, "id") }, data: { status } });
    await audit({ actorId: user.id, action: `contact.${status.toLowerCase()}`, entityType: "contact_message", entityId: str(fd, "id") });
    return "Message updated.";
  });
}
