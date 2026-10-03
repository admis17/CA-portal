// Resend email, server-only. Plain fetch (no extra dep). Never throws and never
// fails the calling action: returns false when unconfigured or on error.
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const wrap = (title: string, body: string) => `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;border:1px solid #E7E5DE;border-radius:16px;overflow:hidden">
<div style="background:#052E27;color:#fff;padding:16px 24px;font-weight:bold">Mehra Associates · Chartered Accountants</div>
<div style="padding:24px"><h2 style="margin:0 0 8px">${title}</h2><p style="color:#1C1917">${body}</p>
<p style="margin-top:24px"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login" style="background:#047857;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Open portal</a></p></div>
</div>`;

export const mailTemplates = {
  assigned: (service: string, client: string, due: string) => ({
    subject: `New task assigned: ${service} for ${client}`,
    html: wrap("Task assigned to you", `${service} for <b>${client}</b> is now on your plate. Due: <b>${due || "—"}</b>.`),
  }),
  statusChanged: (service: string, status: string) => ({
    subject: `Update on your ${service} request: ${status}`,
    html: wrap("Request status update", `Your <b>${service}</b> request moved to <b>${status}</b>.`),
  }),
  newUpload: (service: string, client: string, n: number) => ({
    subject: `New ${service} upload from ${client}`,
    html: wrap("New client upload", `<b>${client}</b> uploaded <b>${n} file(s)</b> for <b>${service}</b>. Open the Document Inbox to assign it.`),
  }),
  taskCompleted: (service: string, client: string) => ({
    subject: `Completed: ${service} for ${client}`,
    html: wrap("Task completed", `<b>${service}</b> for <b>${client}</b> is marked completed.`),
  }),
  passwordReset: (link: string) => ({
    subject: "Reset your portal password",
    html: wrap("Password reset", `Click the link below within 1 hour to set a new password:<br><br><a href="${link}">${link}</a>`),
  }),
};
