import type { AppointmentStatus } from "../lib/types";
import { STATUS_META } from "../lib/types";

export default function StatusPill({ status }: { status: AppointmentStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full text-[9px] font-bold uppercase tracking-wide px-1.5 py-px shrink-0"
      style={{ background: m.bg, color: m.fg }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: m.fg }} />
      {m.label}
    </span>
  );
}
