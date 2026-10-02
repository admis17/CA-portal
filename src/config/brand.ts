// Single source for firm identity + Sovereign Fiscal Prestige palette (stitch prototype).
// Teloz HTML refs supply layout patterns (glass cards, blurred topbar, dotted pills);
// all colours below come from this file's palette, not Teloz orange.
export const brand = {
  firmName: "Mehra Associates",
  tagline: "Chartered Accountants",
  monogram: "MA",
  colors: {
    sidebar: "#052E27",
    primary: "#047857",
    primaryDeep: "#0F766E",
    gold: "#D4A017",
    canvas: "#F7F6F2",
    card: "#FFFFFF",
    ink: "#1C1917",
    muted: "#6B7280",
    line: "#E7E5DE",
  },
  dark: { canvas: "#07130F", card: "#0E221C", line: "#1E3A32" },
  // Status pills (PRD section 6) — used from Phase 3 on; defined once here.
  status: {
    unassigned: { label: "Unassigned", fg: "#DC2626", bg: "#FEF2F2" },
    assigned: { label: "Assigned", fg: "#2563EB", bg: "#EFF6FF" },
    in_progress: { label: "In Progress", fg: "#D97706", bg: "#FFFBEB" },
    under_review: { label: "Under Review", fg: "#7C3AED", bg: "#F5F3FF" },
    completed: { label: "Completed", fg: "#16A34A", bg: "#F0FDF4" },
  },
  services: ["GST Return", "ITR Filing", "TDS Return", "Audit", "Bookkeeping", "Other"],
} as const;

export const homeForRole = { admin: "/admin/dashboard", employee: "/employee/today", client: "/client/requests" } as const;
export type Role = keyof typeof homeForRole;
