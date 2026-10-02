// DEMO ONLY store: uploads + inbox persist as JSON/bytes under the OS temp dir
// (server-module memory is NOT shared across routes in dev, so disk it is).
// Never imported by real-mode code paths. Wiped when Supabase is connected.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { demoClientRequests, type DemoRequest } from "./demo";

export type DemoInboxFile = { name: string; size: number; mime: string; key?: string };
export type DemoInboxItem = {
  id: string; client: string; phone: string; service: string;
  note: string; received: string; username: string; files: DemoInboxFile[];
};

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

const dir = path.join(os.tmpdir(), "ca-portal-demo");
const indexFile = path.join(dir, "index.json");
const safe = (key: string) => key.replace(/\//g, "__");

function readIndex(): DemoInboxItem[] {
  try {
    return JSON.parse(fs.readFileSync(indexFile, "utf8")) as DemoInboxItem[];
  } catch {
    return [];
  }
}

export function getDemoInbox(): DemoInboxItem[] {
  return [...readIndex(), ...demoInboxSeed];
}
export function addDemoInboxItem(item: DemoInboxItem) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify([item, ...readIndex().filter((i) => i.id !== item.id)]));
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
// Client's own uploads (unassigned) on top of the static demo requests.
export function getDemoClientRequests(username: string): DemoRequest[] {
  const mine = getDemoInbox()
    .filter((i) => i.username === username)
    .map((i) => ({
      id: i.id, service: i.service,
      note: i.note || `${i.files.length} file(s) uploaded`,
      status: "unassigned" as const, updated: i.received,
    }));
  return [...mine, ...demoClientRequests];
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
