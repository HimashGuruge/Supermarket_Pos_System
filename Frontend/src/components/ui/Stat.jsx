import { ArrowUpRight, ArrowDownRight } from "lucide-react";

// A key metric tile. `trend` shows a small up/down arrow with a delta.
//   <Stat label="Total Sales" value="Rs 128,430" trend="+8.2%" />
//   <Stat label="Today's Orders" value="142" />
//   <Stat label="Total Revenue" value="Rs 120.000" subtitle="All completed" />

const lightTones = {
  green: "bg-emerald-500/10 text-emerald-600",
  red: "bg-rose-500/10 text-rose-600",
  blue: "bg-sky-500/10 text-sky-600",
  amber: "bg-amber-500/10 text-amber-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
};
const darkTones = {
  green: "bg-emerald-500/15 text-emerald-300",
  red: "bg-rose-500/15 text-rose-300",
  blue: "bg-sky-500/15 text-sky-300",
  amber: "bg-amber-500/15 text-amber-300",
  indigo: "bg-indigo-500/15 text-indigo-300",
};

export default function Stat({ label, value, trend, subtitle, icon, tone = "indigo", dark = false }) {
  const sign = trend?.match("-") ? "down" : "up";
  const toneColors = dark ? darkTones[tone] : lightTones[tone];
  return (
    <div className={`rounded-2xl border bg-card p-5 shadow-card ${
      dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-card"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`text-sm font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>{label}</div>
        {icon ? (
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneColors}`}>
            <icon size={16} />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <div className={`text-2xl font-bold ${dark ? "text-slate-100" : "text-slate-800"}`}>{value}</div>
        {trend ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${toneColors}`}>
            {sign === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </span>
        ) : null}
      </div>
      {subtitle ? <div className="mt-1 text-xs text-slate-400">{subtitle}</div> : null}
    </div>
  );
}
