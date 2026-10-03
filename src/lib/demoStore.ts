// DEMO ONLY store: uploads + inbox + assignment + status + notifications persist as
// JSON/bytes under the OS temp dir (server-module memory is NOT shared across
// routes in dev, so disk it is). Never imported by real-mode code paths.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { demoClientRequests, type DemoRequest, type StatusKey } from "./demo";

export type DemoInboxFile = { name: string; size: number; mime: string; key?: string };
export type DemoComment = { author: string; body: string; at: string };
export type DemoInboxItem = {
  id: string; client: string; phone: string; service: string;
  note: string; received: string; username: string; files: DemoInboxFile[];
  status?: StatusKey; assignedTo?: string; dueDate?: string; priority?: string;
  history?: string[]; comments?: DemoComment[];
};
export type DemoNotif = { id: string; username: string; message: string; at: string; read: boolean };

export const demoInboxSeed: DemoInboxItem[] = [
  {
    id: "seed-1", client: "Sundaram Logistics Pvt Ltd", phone: "+91 98200 11111",
    service: "GST Return", note: "October GSTR-1 + 3B", received: "Today, 09:15 AM", username: "seed",
    files: [
      { name: "Sales_Register_Oct.xlsx", size: 2_400_000, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { name: "Purchase_GSTR2B.pdf", size: 840_000, mime: "application/pdf" },
    ],
  },
  {
    id: "seed-2", client: "Ananya Deshmukh", phone: "+91 99870 22222",
    service: "ITR Filing", note: "ITR-3 tax audit", received: "Today, 10:42 AM", username: "seed",
    files: [
      { name: "Bank_Statements_FY23-24.zip", size: 14_200_000, mime: "application/zip" },
      { name: "Form26AS.pdf", size: 1_100_000, mime: "application/pdf" },
    ],
  },
];

// Pre-assigned demo work for the demo employee login (username "employee").
export const demoAssignedSeed: DemoInboxItem[] = [
  {
    id: "seed-t1", client: "Sharma Textiles", phone: "+91 98200 12345",
    service: "GST Return", note: "GSTR-3B for March", received: "Mon, 09:00 AM", username: "seed-client",
    status: "in_progress", assignedTo: "employee", dueDate: "Today", priority: "high",
    history: ["Assigned to you · Mon", "Started · Tue"],
    files: [{ name: "GSTR-2B_Reconciliation.xlsx", size: 1_200_000, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
  },
  {
    id: "seed-t2", client: "Rahul Mehta", phone: "+91 99870 44556",
    service: "ITR Filing", note: "ITR-2 with capital gains", received: "Mon, 11:30 AM", username: "client",
    status: "assigned", assignedTo: "employee", dueDate: "Overdue by 1 day", priority: "high",
    history: ["Assigned to you · Mon"],
    files: [{ name: "Capital_Gains_PnL.pdf", size: 900_000, mime: "application/pdf" }],
  },
  {
    id: "seed-t3", client: "Kavita Rao", phone: "+91 98111 22334",
    service: "TDS Return", note: "Q4 24Q filing", received: "Tue, 10:00 AM", username: "seed-client",
    status: "assigned", assignedTo: "employee", dueDate: "Fri", priority: "normal",
    history: ["Assigned to you · Tue"],
    files: [{ name: "TDS_Challans_Q4.pdf", size: 640_000, mime: "application/pdf" }],
  },
  {
    id: "seed-t4", client: "Bansal Traders", phone: "+91 98300 66778",
    service: "Bookkeeping", note: "March ledger reconciliation", received: "Tue, 02:15 PM", username: "seed-client",
    status: "under_review", assignedTo: "employee", dueDate: "Fri", priority: "normal",
    history: ["Assigned to you · Tue", "Started · Wed", "Sent for review · Thu"],
    files: [{ name: "March_Ledger.xlsx", size: 2_100_000, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
  },
  {
    id: "seed-p1", client: "Navkar Polyfilms LLP", phone: "+91 98250 33445",
    service: "TDS Return", note: "Q2 filing · ack #8841029410", received: "14 Oct", username: "seed-client",
    status: "completed", assignedTo: "employee", dueDate: "14 Oct", priority: "normal",
    history: ["Assigned · 10 Oct", "Started · 11 Oct", "Completed on time · 14 Oct"],
    files: [{ name: "TDS_Return_Q2.pdf", size: 780_000, mime: "application/pdf" }],
  },
];

const dir = path.join(os.tmpdir(), "ca-portal-demo");
const indexFile = path.join(dir, "index.json");
const notifFile = path.join(dir, "notifs.json");
const safe = (key: string) => key.replace(/\//g, "__");

function readIndex(): DemoInboxItem[] {
  try {
    return JSON.parse(fs.readFileSync(indexFile, "utf8")) as DemoInboxItem[];
  } catch {
    return [];
  }
}
function allItems(): DemoInboxItem[] {
  const disk = readIndex();
  const ids = new Set(disk.map((i) => i.id));
  return [...disk, ...demoAssignedSeed.filter((i) => !ids.has(i.id))];
}
function saveItem(item: DemoInboxItem) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify([item, ...readIndex().filter((i) => i.id !== item.id)]));
}

// Unassigned inbox (admin view): user uploads still open + static seeds.
export function getDemoInbox(): DemoInboxItem[] {
  const open = readIndex().filter((i) => !i.status || i.status === "unassigned");
  return [...open, ...demoInboxSeed];
}
export function addDemoInboxItem(item: DemoInboxItem) {
  saveItem({ ...item, status: item.status ?? "unassigned" });
}
export function getDemoItem(id: string): DemoInboxItem | undefined {
  return allItems().find((i) => i.id === id) ?? demoInboxSeed.find((i) => i.id === id);
}
export function assignDemoItem(id: string, employee: string, due: string, priority: string) {
  const item = getDemoItem(id);
  if (!item) return false;
  saveItem({
    ...item, assignedTo: employee, dueDate: due, priority,
    status: item.status === "unassigned" || !item.status ? "assigned" : item.status,
    history: [...(item.history ?? []), `Assigned to ${employee} · Just now`],
  });
  return true;
}
export function statusDemoItem(id: string, to: StatusKey) {
  const item = getDemoItem(id);
  if (!item) return undefined;
  const next = { ...item, status: to, history: [...(item.history ?? []), `Status → ${to} · Just now`] };
  saveItem(next);
  return next;
}
export function commentDemoItem(id: string, author: string, body: string) {
  const item = getDemoItem(id);
  if (!item) return false;
  saveItem({ ...item, comments: [...(item.comments ?? []), { author, body, at: "Just now" }] });
  return true;
}
export function putDemoBytes(key: string, buf: Buffer, mime: string, name: string) {
  if (buf.length > 25 * 1024 * 1024) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safe(key)), buf);
  fs.writeFileSync(path.join(dir, `${safe(key)}.meta.json`), JSON.stringify({ mime, name }));
}
export function getDemoBytes(key: string) {
  try {
    const buf = fs.readFileSync(path.join(dir, safe(key)));
    const meta = JSON.parse(fs.readFileSync(path.join(dir, `${safe(key)}.meta.json`), "utf8")) as {
      mime: string;
      name: string;
    };
    return { buf, mime: meta.mime, name: meta.name };
  } catch {
    return undefined;
  }
}
// Employee work lists from assigned store items.
export function getDemoEmployeeTasks(username: string) {
  const mine = allItems().filter((i) => i.assignedTo === username);
  return {
    today: mine.filter((i) => i.status === "in_progress" || i.status === "assigned" && (i.dueDate === "Today" || (i.dueDate ?? "").startsWith("Overdue"))),
    week: mine.filter((i) => (i.status === "assigned" || i.status === "under_review") && i.dueDate !== "Today" && !(i.dueDate ?? "").startsWith("Overdue")),
    past: mine.filter((i) => i.status === "completed"),
  };
}
// Client's own uploads (any status) on top of the static demo requests.
export function getDemoClientRequests(username: string): DemoRequest[] {
  const mine = readIndex()
    .filter((i) => i.username === username)
    .map((i) => ({
      id: i.id, service: i.service,
      note: i.note || `${i.files.length} file(s) uploaded`,
      status: (i.status ?? "unassigned") as StatusKey, updated: i.received,
    }));
  return [...mine, ...demoClientRequests];
}

// Demo notifications (per-username, file-backed).
function readNotifs(): DemoNotif[] {
  try {
    return JSON.parse(fs.readFileSync(notifFile, "utf8")) as DemoNotif[];
  } catch {
    return [];
  }
}
export function getDemoNotifs(username: string): DemoNotif[] {
  return readNotifs().filter((n) => n.username === username);
}
export function addDemoNotif(username: string, message: string) {
  fs.mkdirSync(dir, { recursive: true });
  const n = { id: `n-${Date.now()}`, username, message, at: "Just now", read: false };
  fs.writeFileSync(notifFile, JSON.stringify([n, ...readNotifs()]));
}
export function markDemoNotifsRead(username: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(notifFile, JSON.stringify(readNotifs().map((n) => (n.username === username ? { ...n, read: true } : n))));
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
