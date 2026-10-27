"use server";
import { randomUUID } from "node:crypto";
import type { NavLocation } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import { safeUrl } from "@/lib/url";
import { badRequest, conflict, isUniqueViolation } from "@/lib/errors";
import { config } from "@/config/env";
import { parseItemLines } from "@/server/services/content";
import { loadSettings, saveSettingsGroup, type SiteSettings } from "@/server/services/settings";
import { getStorage, sniffImageType } from "@/server/adapters/storage";
import { bool, optInt, optStr, runAdminAction, str } from "./run";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function saveSettingsAction(fd: FormData) {
  return runAdminAction("settings.manage", "/admin/settings", async ({ user, ip }) => {
    const group = str(fd, "group") as keyof SiteSettings;
    const current = await loadSettings();
    let value: SiteSettings[keyof SiteSettings];
    switch (group) {
      case "branding": {
        const colors = ["brandColor", "brandDarkColor", "inkColor", "accentColor"] as const;
        for (const c of colors) if (!HEX.test(str(fd, c))) throw badRequest(`${c} must be a hex colour like #C2410C.`);
        value = {
          clubName: str(fd, "clubName") || current.branding.clubName,
          tagline: str(fd, "tagline"),
          logoUrl: safeUrl(optStr(fd, "logoUrl")) ?? "",
          heroImageUrl: safeUrl(optStr(fd, "heroImageUrl")) ?? "",
          brandColor: str(fd, "brandColor"),
          brandDarkColor: str(fd, "brandDarkColor"),
          inkColor: str(fd, "inkColor"),
          accentColor: str(fd, "accentColor"),
          footerText: str(fd, "footerText"),
        };
        break;
      }
      case "contact":
        value = { email: str(fd, "email"), phone: str(fd, "phone"), whatsapp: str(fd, "whatsapp"), address: str(fd, "address"), mapEmbedUrl: safeUrl(optStr(fd, "mapEmbedUrl")) ?? "", meetingPoint: str(fd, "meetingPoint"), hours: str(fd, "hours") };
        break;
      case "social":
        value = { instagram: safeUrl(optStr(fd, "instagram")) ?? "", facebook: safeUrl(optStr(fd, "facebook")) ?? "", x: safeUrl(optStr(fd, "x")) ?? "", youtube: safeUrl(optStr(fd, "youtube")) ?? "", strava: safeUrl(optStr(fd, "strava")) ?? "" };
        break;
      case "membership": {
        const currency = (str(fd, "currency") || "INR").toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("Currency must be a 3-letter ISO code.");
        value = {
          applicationsOpen: bool(fd, "applicationsOpen"),
          requireApproval: bool(fd, "requireApproval"),
          requireDateOfBirth: bool(fd, "requireDateOfBirth"),
          requireEmergencyContact: bool(fd, "requireEmergencyContact"),
          currency,
          renewalsEnabled: bool(fd, "renewalsEnabled"),
          renewalReminderDays: optInt(fd, "renewalReminderDays") ?? 14,
        };
        break;
      }
      case "seo":
        value = { defaultTitle: str(fd, "defaultTitle"), defaultDescription: str(fd, "defaultDescription") };
        break;
      default:
        throw badRequest("Unknown settings group");
    }
    await saveSettingsGroup(group, value as never, user.id);
    await audit({ actorId: user.id, action: `settings.${group}.updated`, entityType: "website_settings", entityId: group, ip });
    return "Settings saved.";
  });
}

export async function savePageAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("content.manage", id ? `/admin/pages/${id}` : "/admin/pages", async ({ user }) => {
    const title = str(fd, "title");
    if (!title) throw badRequest("Title is required.");
    const data = { title, metaDescription: optStr(fd, "metaDescription"), body: optStr(fd, "body"), isPublished: bool(fd, "isPublished") };
    try {
      if (id) {
        await prisma.websitePage.update({ where: { id }, data });
        await audit({ actorId: user.id, action: "page.updated", entityType: "website_page", entityId: id });
        return "Page saved.";
      }
      const page = await prisma.websitePage.create({ data: { ...data, slug: slugify(str(fd, "slug") || title) } });
      await audit({ actorId: user.id, action: "page.created", entityType: "website_page", entityId: page.id });
      return { message: `Page created at /${page.slug}.`, redirectTo: `/admin/pages/${page.id}` };
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_slug", "A page with this URL already exists.");
      throw e;
    }
  });
}

export async function saveSectionAction(fd: FormData) {
  const pageId = str(fd, "pageId");
  return runAdminAction("content.manage", `/admin/pages/${pageId}`, async ({ user }) => {
    const id = str(fd, "id");
    const data = {
      title: optStr(fd, "title"),
      subtitle: optStr(fd, "subtitle"),
      body: optStr(fd, "body"),
      items: parseItemLines(str(fd, "items")),
      imageId: optStr(fd, "imageId"),
      ctaLabel: optStr(fd, "ctaLabel"),
      ctaHref: safeUrl(optStr(fd, "ctaHref")),
      sortOrder: optInt(fd, "sortOrder") ?? 0,
      isPublished: bool(fd, "isPublished"),
    };
    if (id) await prisma.contentSection.update({ where: { id, pageId }, data });
    else {
      const key = slugify(str(fd, "key"));
      if (!key) throw badRequest("Section key is required.");
      await prisma.contentSection.create({ data: { ...data, key, pageId } }).catch((e) => {
        if (isUniqueViolation(e)) throw conflict("duplicate_key", "This page already has a section with that key.");
        throw e;
      });
    }
    await audit({ actorId: user.id, action: "section.saved", entityType: "website_page", entityId: pageId, metadata: { sectionId: id || null } });
    return "Section saved.";
  });
}

export async function saveNavAction(fd: FormData) {
  return runAdminAction("content.manage", "/admin/navigation", async ({ user }) => {
    const id = str(fd, "id");
    if (str(fd, "delete") === "1" && id) {
      await prisma.navigationLink.delete({ where: { id } });
      await audit({ actorId: user.id, action: "nav.deleted", entityType: "navigation_link", entityId: id });
      return "Link removed.";
    }
    const label = str(fd, "label");
    const href = safeUrl(str(fd, "href"));
    if (!label || !href) throw badRequest("Label and link are required.");
    const data = { label, href, location: (str(fd, "location") === "FOOTER" ? "FOOTER" : "HEADER") as NavLocation, sortOrder: optInt(fd, "sortOrder") ?? 0, isActive: bool(fd, "isActive") };
    if (id) await prisma.navigationLink.update({ where: { id }, data });
    else await prisma.navigationLink.create({ data });
    await audit({ actorId: user.id, action: "nav.saved", entityType: "navigation_link", entityId: id || null });
    return "Navigation saved.";
  });
}

export async function saveNewsAction(fd: FormData) {
  const id = str(fd, "id");
  return runAdminAction("content.manage", id ? `/admin/news/${id}` : "/admin/news/new", async ({ user }) => {
    const title = str(fd, "title");
    const body = str(fd, "body");
    if (!title || !body) throw badRequest("Title and body are required.");
    const status = str(fd, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const existing = id ? await prisma.newsPost.findUnique({ where: { id } }) : null;
    const data = {
      title,
      slug: slugify(str(fd, "slug") || title),
      excerpt: optStr(fd, "excerpt"),
      body,
      category: str(fd, "category") || "Announcement",
      status: status as "DRAFT" | "PUBLISHED",
      publishedAt: status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
      coverId: optStr(fd, "coverId"),
    };
    try {
      const post = id ? await prisma.newsPost.update({ where: { id }, data }) : await prisma.newsPost.create({ data });
      await audit({ actorId: user.id, action: id ? "news.updated" : "news.created", entityType: "news_post", entityId: post.id, metadata: { status } });
      return id ? "Post saved." : { message: "Post created.", redirectTo: `/admin/news/${post.id}` };
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_slug", "Another post already uses this URL slug.");
      throw e;
    }
  });
}

export async function deleteNewsAction(fd: FormData) {
  return runAdminAction("content.manage", "/admin/news", async ({ user }) => {
    await prisma.newsPost.delete({ where: { id: str(fd, "id") } });
    await audit({ actorId: user.id, action: "news.deleted", entityType: "news_post", entityId: str(fd, "id") });
    return "Post deleted.";
  });
}

export async function uploadMediaAction(fd: FormData) {
  return runAdminAction("media.manage", str(fd, "back") || "/admin/media", async ({ user }) => {
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw badRequest("Choose at least one image.");
    if (files.length > 20) throw badRequest("Upload at most 20 images at a time.");
    const albumId = optStr(fd, "albumId");
    const alt = str(fd, "altText");
    const storage = getStorage();
    let n = 0;
    for (const file of files) {
      if (file.size > config.UPLOAD_MAX_MB * 1024 * 1024) throw badRequest(`${file.name} is larger than ${config.UPLOAD_MAX_MB} MB.`);
      const buf = Buffer.from(await file.arrayBuffer());
      const type = sniffImageType(buf);
      if (!type) throw badRequest(`${file.name} is not a JPEG, PNG or WebP image.`);
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
      const key = `images/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
      const { url } = await storage.put(key, buf, type);
      await prisma.mediaAsset.create({ data: { storageKey: key, url, originalName: file.name.slice(0, 200), mimeType: type, sizeBytes: buf.length, altText: alt, albumId, uploadedById: user.id } });
      n++;
    }
    await audit({ actorId: user.id, action: "media.uploaded", entityType: "media_asset", metadata: { count: n, albumId } });
    return `${n} image${n === 1 ? "" : "s"} uploaded.`;
  });
}

export async function updateMediaAction(fd: FormData) {
  return runAdminAction("media.manage", str(fd, "back") || "/admin/media", async ({ user }) => {
    const id = str(fd, "id");
    if (str(fd, "delete") === "1") {
      const m = await prisma.mediaAsset.delete({ where: { id } });
      await getStorage().remove(m.storageKey);
      await audit({ actorId: user.id, action: "media.deleted", entityType: "media_asset", entityId: id });
      return "Image deleted.";
    }
    await prisma.mediaAsset.update({ where: { id }, data: { altText: str(fd, "altText"), caption: optStr(fd, "caption"), albumId: optStr(fd, "albumId"), sortOrder: optInt(fd, "sortOrder") ?? 0 } });
    return "Image updated.";
  });
}

export async function saveAlbumAction(fd: FormData) {
  return runAdminAction("media.manage", "/admin/media", async ({ user }) => {
    const id = str(fd, "id");
    const title = str(fd, "title");
    if (!title) throw badRequest("Album title is required.");
    const data = { title, description: optStr(fd, "description"), takenOn: str(fd, "takenOn") ? new Date(`${str(fd, "takenOn")}T00:00:00Z`) : null, coverId: optStr(fd, "coverId"), isPublished: bool(fd, "isPublished") };
    try {
      if (id) await prisma.galleryAlbum.update({ where: { id }, data });
      else await prisma.galleryAlbum.create({ data: { ...data, slug: slugify(title) } });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("duplicate_slug", "An album with this title already exists.");
      throw e;
    }
    await audit({ actorId: user.id, action: "album.saved", entityType: "gallery_album", entityId: id || null });
    return "Album saved.";
  });
}

export async function saveCommitteeAction(fd: FormData) {
  return runAdminAction("content.manage", "/admin/people", async ({ user }) => {
    const id = str(fd, "id");
    if (str(fd, "delete") === "1" && id) {
      await prisma.committeeMember.delete({ where: { id } });
      return "Committee member removed.";
    }
    const data = { name: str(fd, "name"), role: str(fd, "role"), bio: optStr(fd, "bio"), photoId: optStr(fd, "photoId"), sortOrder: optInt(fd, "sortOrder") ?? 0, isActive: bool(fd, "isActive") };
    if (!data.name || !data.role) throw badRequest("Name and role are required.");
    if (id) await prisma.committeeMember.update({ where: { id }, data });
    else await prisma.committeeMember.create({ data });
    await audit({ actorId: user.id, action: "committee.saved", entityType: "committee_member", entityId: id || null });
    return "Committee saved.";
  });
}

export async function saveTestimonialAction(fd: FormData) {
  return runAdminAction("content.manage", "/admin/people", async ({ user }) => {
    const id = str(fd, "id");
    if (str(fd, "delete") === "1" && id) {
      await prisma.testimonial.delete({ where: { id } });
      return "Testimonial removed.";
    }
    const data = { quote: str(fd, "quote"), author: str(fd, "author"), context: optStr(fd, "context"), sortOrder: optInt(fd, "sortOrder") ?? 0, isActive: bool(fd, "isActive") };
    if (!data.quote || !data.author) throw badRequest("Quote and author are required.");
    if (id) await prisma.testimonial.update({ where: { id }, data });
    else await prisma.testimonial.create({ data });
    await audit({ actorId: user.id, action: "testimonial.saved", entityType: "testimonial", entityId: id || null });
    return "Testimonial saved.";
  });
}
