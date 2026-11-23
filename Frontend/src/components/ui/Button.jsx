import { Loader2 } from "lucide-react";

// A small set of styled buttons. `variant` picks the look.
//   primary   — the violet action button (Add, Save, Complete…)
//   secondary — a neutral outlined button (Cancel, Close)
//   danger    — a soft red button (Delete, Cancel sale)
//   ghost     — a plain hover button (no border)
//
// Use it like: <Button iconLeft={<Plus size={16} />}>Add</Button>

const styles = {
  primary: "bg-indigo-600 text-white shadow-card hover:bg-indigo-700",
  secondary:
    "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
  danger: "bg-rose-600 text-white shadow-card hover:bg-rose-700",
  ghost: "text-slate-600 hover:bg-slate-100",
};
// Same buttons, but for a dark page (only used when dark prop is set).
const darkStyles = {
  primary: "bg-indigo-500 text-white shadow-card hover:bg-indigo-600",
  secondary:
    "border border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600",
  danger: "bg-rose-500 text-white shadow-card hover:bg-rose-600",
  ghost: "text-slate-200 hover:bg-slate-700",
};

export default function Button({
  as: Component = "button",
  variant = "primary",
  iconLeft,
  iconRight,
  loading,
  disabled,
  type,
  className,
  dark = false,
  children,
  ...rest
}) {
  const tone = dark ? darkStyles[variant] : styles[variant];
  return (
    <Component
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-60 ${tone} ${className ?? ""}`}
    >
      {loading && <Loader2 className="animate-spin" size={16} />}
      {iconLeft && <iconLeft size={16} />}
      {children != null && children !== false ? <>{children}</> : null}
      {iconRight && <iconRight size={16} />}
    </Component>
  );
}
