// DEMO ONLY dataset. Used solely when Supabase env is absent (see envConfigured
// branches in pages). Never imported by any server action; harmless in prod builds.
export type StatusKey = "unassigned" | "assigned" | "in_progress" | "under_review" | "completed";

export const progressFor: Record<StatusKey, number> = {
  unassigned: 0,
  assigned: 25,
  in_progress: 50,
  under_review: 75,
  completed: 100,
};

export const demoStats = [
  { label: "Awaiting assignment", value: "6", hint: "2 received today" },
  { label: "In progress", value: "14", hint: "3 due this week" },
  { label: "Completed (30d)", value: "32", hint: "29 on time" },
  { label: "On-time rate", value: "92%", hint: "rolling 30 days" },
];

export const demoActivity = [
  { text: "Rahul Mehta uploaded 3 files for GST Return", time: "10 min ago" },
  { text: "Priya Sharma moved ITR Filing to Under Review", time: "1 hr ago" },
  { text: "Admin assigned TDS Return to Amit Verma", time: "3 hrs ago" },
  { text: "Audit for Sharma Textiles completed on time", time: "Yesterday" },
  { text: "New client Kavita Rao signed up", time: "Yesterday" },
];

export type DemoEmployee = { id: string; username: string; full_name: string; is_active: boolean; open: number };

export const demoEmployees: DemoEmployee[] = [
  { id: "demo-1", username: "employee", full_name: "Priya Sharma", is_active: true, open: 5 },
  { id: "demo-2", username: "sneha.iyer", full_name: "Sneha Iyer", is_active: true, open: 3 },
  { id: "demo-3", username: "rohan.das", full_name: "Rohan Das", is_active: true, open: 7 },
  { id: "demo-4", username: "amit.verma", full_name: "Amit Verma", is_active: false, open: 0 },
];

export type DemoTask = {
  id: string;
  service: string;
  client: string;
  phone: string;
  due: string;
  dueLate?: boolean;
  status: StatusKey;
  note: string;
};

export const demoTasksToday: DemoTask[] = [
  { id: "t1", service: "GST Return", client: "Sharma Textiles", phone: "+91 98200 12345", due: "Due today", status: "in_progress", note: "GSTR-3B for March" },
  { id: "t2", service: "ITR Filing", client: "Rahul Mehta", phone: "+91 99870 44556", due: "Overdue by 1 day", dueLate: true, status: "assigned", note: "ITR-2 with capital gains" },
];

export const demoTasksWeek: DemoTask[] = [
  { id: "t3", service: "TDS Return", client: "Kavita Rao", phone: "+91 98111 22334", due: "Due Fri", status: "assigned", note: "Q4 24Q filing" },
  { id: "t4", service: "Bookkeeping", client: "Bansal Traders", phone: "+91 98300 66778", due: "Due Fri", status: "under_review", note: "March ledger reconciliation" },
];

export type DemoRequest = { id: string; service: string; note: string; status: StatusKey; updated: string };

export const demoClientRequests: DemoRequest[] = [
  { id: "r1", service: "ITR Filing", note: "FY 2024-25 · ITR-2 with capital gains", status: "under_review", updated: "Updated 2 hrs ago" },
  { id: "r2", service: "GST Return", note: "March · GSTR-1 + 3B", status: "in_progress", updated: "Updated yesterday" },
  { id: "r3", service: "Other", note: "PAN correction application", status: "completed", updated: "Completed Mar 28 · on time" },
];
