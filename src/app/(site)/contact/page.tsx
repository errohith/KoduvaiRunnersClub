import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Contact Us", description: "Get in touch with the club." };

const ALLOWED_MAP_HOSTS = ["www.google.com", "maps.google.com", "www.openstreetmap.org"];

export default async function ContactPage() {
  const { contact, social } = await getSettings();
  let mapSrc: string | null = null;
  try {
    if (contact.mapEmbedUrl && ALLOWED_MAP_HOSTS.includes(new URL(contact.mapEmbedUrl).host)) mapSrc = contact.mapEmbedUrl;
  } catch {}
  const socials = Object.entries(social).filter(([, v]) => v);
  return (
    <>
      <PageHeader eyebrow="Contact" title="Get in touch" subtitle="Questions about membership, events or volunteering? We'd love to hear from you." />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-5">
        <div className="card p-6 sm:p-8 lg:col-span-3">
          <h2 className="font-display text-2xl font-bold uppercase">Send a message</h2>
          <div className="mt-5"><ContactForm /></div>
        </div>
        <aside className="space-y-6 lg:col-span-2">
          <div className="card p-6">
            <h2 className="font-display text-xl font-bold uppercase">Club contact</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {contact.email && <div><dt className="text-slate-600">Email</dt><dd><a className="font-medium text-brand hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>}
              {contact.phone && <div><dt className="text-slate-600">Phone</dt><dd><a className="font-medium hover:underline" href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a></dd></div>}
              {contact.whatsapp && <div><dt className="text-slate-600">WhatsApp</dt><dd className="font-medium">{contact.whatsapp}</dd></div>}
              {contact.address && <div><dt className="text-slate-600">Address</dt><dd className="font-medium">{contact.address}</dd></div>}
              {contact.meetingPoint && <div><dt className="text-slate-600">Weekly meeting point</dt><dd className="font-medium">{contact.meetingPoint}</dd></div>}
              {contact.hours && <div><dt className="text-slate-600">Group run times</dt><dd className="font-medium">{contact.hours}</dd></div>}
            </dl>
            {socials.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socials.map(([k, v]) => (
                  <li key={k}><a href={v} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm capitalize">{k}</a></li>
                ))}
              </ul>
            )}
          </div>
          {mapSrc && (
            <iframe title="Map showing the club location" src={mapSrc} className="aspect-[4/3] w-full rounded-2xl border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          )}
        </aside>
      </div>
    </>
  );
}
