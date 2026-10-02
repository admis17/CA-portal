import { Upload } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { requireProfile } from "@/lib/auth";
import { brand } from "@/config/brand";
import { createRequest } from "@/lib/actions/requests";

export const dynamic = "force-dynamic";

export default async function UploadPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await requireProfile(["client"]);
  const sp = await searchParams;
  return (
    <Shell role="client" fullName={p.full_name} username={p.username} active="/client/upload">
      <div className="flex items-center gap-3 mb-1">
        <span className="tile tile-sm t-emerald"><Upload size={18} /></span>
        <h1 className="font-display font-bold text-2xl">Upload Documents</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Choose a service, attach your files, and add a note. PDF, images, Excel, Word, CSV · max 25 MB per file.
      </p>
      {sp.error && <p className="pill mb-4" style={{ background: "#FEF2F2", color: "#DC2626" }}><span className="d" />{sp.error}</p>}
      <div className="glass-card p-6 max-w-[560px]">
        <form action={createRequest} encType="multipart/form-data" className="flex flex-col gap-4">
          <div>
            <label className="lbl" htmlFor="service">Service</label>
            <select id="service" name="service" className="input" required defaultValue="">
              <option value="" disabled>Select a service…</option>
              {brand.services.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="files">Files</label>
            <input id="files" name="files" type="file" multiple required
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.doc,.docx,.csv"
              className="input !h-auto !py-2.5" />
          </div>
          <div>
            <label className="lbl" htmlFor="note">Note (optional)</label>
            <textarea id="note" name="note" rows={3} maxLength={500} className="input !h-auto !py-2.5" placeholder="Assessment year, period, anything the CA should know…" />
          </div>
          <button className="btn-primary" type="submit">Upload documents</button>
        </form>
      </div>
    </Shell>
  );
}
