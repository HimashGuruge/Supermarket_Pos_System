// A labelled dropdown, styled like Input. `children` holds the <option>s.

export default function Select({
  label,
  icon,
  error,
  hint,
  id,
  className = "",
  dark = false,
  children,
  ...rest
}) {
  const inputId = id || label;
  const shadow = dark ? "shadow-[0_1px_0_0_rgb(15_23_42 / 0.3)]" : "shadow-[0_1px_0_0_rgb(226_232_240 / 0.6)]";
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className={`text-sm font-medium ${
          dark ? "text-slate-300" : "text-slate-600"
        }`}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <icon
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
        )}
        <select
          id={inputId}
          className={`w-full rounded-lg border bg-card py-2 text-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 ${
            dark
              ? "border-slate-600 text-slate-100 focus:ring-indigo-500/40"
              : "border-slate-200 text-slate-800 focus:ring-indigo-100"
          } ${icon ? "pl-9 pr-3" : "px-3"} ${className}`}
          {...rest}
        >
          {children}
        </select>
      </div>
      {error ? (
        <p className="text-xs font-medium text-rose-500">{error}</p>
      ) : hint ? (
        <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-400"}`}>{hint}</p>
      ) : null}
    </div>
  );
}
