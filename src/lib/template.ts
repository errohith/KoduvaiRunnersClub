/** {{variable}} substitution. Values are HTML-escaped when rendering HTML bodies. */
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderTemplate(tpl: string, vars: Record<string, unknown>, opts: { html?: boolean } = {}) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    const s = v === undefined || v === null ? "" : String(v);
    return opts.html ? escapeHtml(s) : s;
  });
}

export function templateVariables(tpl: string): string[] {
  return [...new Set([...tpl.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
}
