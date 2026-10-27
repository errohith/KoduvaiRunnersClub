/** Single source of truth for permissions and the default role matrix (seeded into the DB). */
export const PERMISSIONS = {
  "dashboard.view": "View the admin dashboard",
  "members.view": "View membership applications and members",
  "members.manage": "Approve, reject and update memberships",
  "members.export": "Export membership data",
  "members.delete": "Permanently delete or anonymise a member's personal data",
  "plans.manage": "Create and edit membership plans and fees",
  "events.view": "View events",
  "events.manage": "Create, edit, publish and cancel events",
  "events.delete": "Permanently delete events and event registrations",
  "registrations.view": "View event registrations",
  "registrations.manage": "Update registration status, attendance and waitlists",
  "registrations.restricted": "View restricted participant data (emergency contacts, medical notes)",
  "registrations.export": "Export participant lists",
  "payments.view": "View payments and revenue reports",
  "payments.manage": "Record refunds and reconcile payments",
  "comms.view": "View announcements and delivery reports",
  "comms.send": "Compose, schedule and send announcements",
  "templates.manage": "Edit notification templates",
  "content.manage": "Edit website pages, navigation, news, committee and testimonials",
  "media.manage": "Upload and manage media and gallery",
  "settings.manage": "Edit branding, contact details and club configuration",
  "contact.view": "View contact form submissions",
  "reports.view": "View reports",
  "users.manage": "Manage admin users and roles",
  "audit.view": "View the audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as Permission[];

export const ROLES: Record<string, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: { name: "Super Admin", description: "Full access including user management", permissions: ALL },
  CLUB_ADMIN: {
    name: "Club Administrator",
    description: "Runs the club day-to-day; everything except user management",
    permissions: ALL.filter((p) => p !== "users.manage" && p !== "members.delete" && p !== "events.delete"),
  },
  MEMBERSHIP_MANAGER: {
    name: "Membership Manager",
    description: "Reviews applications and manages plans",
    permissions: ["dashboard.view", "members.view", "members.manage", "members.export", "plans.manage", "payments.view", "contact.view", "reports.view"],
  },
  EVENT_MANAGER: {
    name: "Event Manager",
    description: "Runs events, registrations and participant lists",
    permissions: ["dashboard.view", "events.view", "events.manage", "registrations.view", "registrations.manage", "registrations.restricted", "registrations.export", "payments.view", "media.manage", "reports.view"],
  },
  COMMUNICATIONS_MANAGER: {
    name: "Communications Manager",
    description: "Announcements, templates, website content and media",
    permissions: ["dashboard.view", "comms.view", "comms.send", "templates.manage", "content.manage", "media.manage", "contact.view", "events.view"],
  },
};
