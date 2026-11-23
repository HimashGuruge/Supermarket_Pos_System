// A card container with an optional title + actions bar.
//   <Card title="Products" icon={<Package .../>} actions={<Button>…</Button>}>
//     …content…
//   </Card>

export default function Card({ title, icon, actions, footer, children, dark = false }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-card shadow-card ${
      dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-card"
    }`}>
      {title && (
        <div className={`flex items-center justify-between border-b px-4 py-3 ${
          dark ? "border-slate-700" : "border-slate-100"
        }`}>
          <h2 className={`flex items-center gap-2 text-base font-semibold ${
            dark ? "text-slate-100" : "text-slate-800"
          }`}>
            {icon && <icon size={18} className={dark ? "text-indigo-400" : "text-indigo-600"} />}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className={`border-t px-4 py-3 ${dark ? "border-slate-700" : "border-slate-100"}`}>{footer}</div>}
    </div>
  );
}
