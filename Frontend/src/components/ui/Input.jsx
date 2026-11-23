// A labelled text field with an optional icon, hint, or error line.
//
//   <Input label="Name *" icon={<Search .../>} value={x} onChange={...} />
//
// All input attributes (value, onChange, type, placeholder, ...) are
// passed as normal props and are spread onto the inner <input>.

export default function Input({
  label,
  icon,
  error,
  hint,
  id,
  type = "text",
  className = "",
  dark = false,
  ...rest
}) {
  const inputId = id || label;
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
        <input
          id={inputId}
          type={type}
          className={`w-full rounded-lg border bg-card py-2 text-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 ${
            dark
              ? "border-slate-600 text-slate-100 focus:ring-indigo-500/40"
              : "border-slate-200 text-slate-800 focus:ring-indigo-100"
          } ${icon ? "pl-9 pr-3" : "px-3"} ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-rose-500">{error}</p>
      ) : hint ? (
        <p className={`text-xs ${dark ? "text-slate-400" : "text-slate-400"}`}>{hint}</p>
      ) : null}
    </div>
  );
}
