import { cn } from "@/lib/utils";

const MAP = {
  TERSEDIA: "text-emerald-700 bg-emerald-50 border-emerald-200",
  HOLD: "text-amber-700 bg-amber-50 border-amber-200",
  TERJUAL: "text-slate-700 bg-slate-100 border-slate-200",
  SERVIS: "text-rose-700 bg-rose-50 border-rose-200",
  DIARSIPKAN: "text-zinc-600 bg-zinc-100 border-zinc-200",
  DRAFT: "text-slate-600 bg-slate-100 border-slate-200",
  TAYANG: "text-blue-700 bg-blue-50 border-blue-200",
  DISEMBUNYIKAN: "text-zinc-600 bg-zinc-100 border-zinc-200",
};

export default function StatusBadge({ status, className }) {
  const cls = MAP[status] || "text-slate-700 bg-slate-100 border-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        cls,
        className
      )}
      data-testid={`status-badge-${status}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
