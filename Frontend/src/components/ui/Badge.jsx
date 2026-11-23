// A small coloured status pill.
//   tones: success green, warning amber, danger red, info sky, neutral grey.

const lightTones = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
  neutral: "bg-slate-100 text-slate-600",
};
const darkTones = {
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-rose-500/15 text-rose-300",
  info: "bg-sky-500/15 text-sky-300",
  neutral: "bg-slate-700 text-slate-300",
};

export default function Badge({ tone = "neutral", children, dark = false }) {
  const tones = dark ? darkTones : lightTones;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
