import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { api, ok, parseJson } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/auth/session";
import { contactSchema } from "@/validation/schemas";
import { enqueueAdminAlert, kick } from "@/server/services/notifications";

export const POST = api(async (req) => {
  const ip = clientIp(await headers());
  await rateLimit(`contact:${ip ?? "unknown"}`, 5, 3600);
  const input = await parseJson(req, contactSchema);
  const msg = await prisma.contactMessage.create({ data: { name: input.name, email: input.email, phone: input.phone, subject: input.subject, message: input.message, ip } });
  kick(await enqueueAdminAlert("contact.message.admin_alert", { senderName: msg.name, senderEmail: msg.email, subject: msg.subject, message: msg.message }, { idempotencyBase: `contact:${msg.id}`, relatedType: "contact_message", relatedId: msg.id }));
  return ok({ id: msg.id }, { status: 201 });
});
