import { cache } from "react";
import { prisma } from "@/lib/db";

export type SectionItem = { label: string; value?: string; detail?: string };

/** Parse "Label | Value | Detail" lines (admin-friendly repeating items). */
export function parseItemLines(text: string): SectionItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label, value, detail] = l.split("|").map((s) => s.trim());
      return { label, value: value || undefined, detail: detail || undefined };
    });
}

export function itemsToLines(items: unknown): string {
  return ((items as SectionItem[]) ?? []).map((i) => [i.label, i.value, i.detail].filter((x) => x !== undefined).join(" | ")).join("\n");
}

export const getPage = cache(async (slug: string) =>
  prisma.websitePage.findUnique({
    where: { slug },
    include: { sections: { where: { isPublished: true }, orderBy: { sortOrder: "asc" }, include: { image: true } } },
  }),
);

export function section(page: Awaited<ReturnType<typeof getPage>>, key: string) {
  return page?.sections.find((s) => s.key === key) ?? null;
}

export const getNavigation = cache(async () => {
  const links = await prisma.navigationLink.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  return { header: links.filter((l) => l.location === "HEADER"), footer: links.filter((l) => l.location === "FOOTER") };
});
