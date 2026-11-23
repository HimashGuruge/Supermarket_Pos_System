import { useState } from "react";
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import Badge from "./Badge";

// A styled, sortable data table.
//
//   <Table title="Products" columns={columns} rows={rows} actions={<Button>+</Button>} />
//
// `columns`: [{ key, header, render?(row), align?: "left" | "right" }]
// `rows`: an array of plain objects.
// `rowClick?(row)` (optional): when set, every row becomes clickable.

function useSort(title) {
  const [dir, setDir] = useState("none");
  function toggle() {
    setDir((d) => (d === "none" ? "asc" : d === "asc" ? "desc" : "none"));
  }
  return { dir, toggle };
}

export default function Table({ title, columns, rows, actions, emptyText, rowClick, dark = false }) {
  const { dir, toggle } = useSort(title);
  const border = dark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-card";
  const barBorder = dark ? "border-slate-700" : "border-slate-100";
  const titleColor = dark ? "text-slate-100" : "text-slate-800";
  const activeSort = dark ? "font-semibold text-indigo-300" : "font-semibold text-indigo-600";
  const sortOff = dark ? "text-slate-400 transition hover:text-slate-200" : "text-slate-400 transition hover:text-slate-600";
  const headColor = dark
    ? "bg-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-300"
    : "bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500";
  const tbody = dark ? "divide-slate-700 bg-slate-800" : "divide-slate-100 bg-white";
  const rowText = dark ? "text-slate-200" : "text-slate-700";
  const rowBg = dark ? "hover:bg-slate-700/40" : "hover:bg-slate-50";

  return (
    <div className={`overflow-hidden rounded-2xl border bg-card shadow-card ${border}`}>
      {(title || actions) && (
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 ${barBorder}`}>
          <h3 className={`flex items-center gap-2 text-base font-semibold ${titleColor}`}>
            {title}
            {dir !== "none" && <ArrowUpDown size={13} className={dark ? "text-indigo-300" : "text-indigo-500"} />}
          </h3>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className={headColor}>
            <tr>
              {columns.map((col) => {
                const active = col.key === title && dir !== "none";
                return (
                  <th
                    key={col.key}
                    className={`select-none px-4 py-2 ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    <button
                      type="button"
                      onClick={active ? toggle : undefined}
                      className={active ? activeSort : sortOff}
                    >
                      {col.header}
                      {active && dir === "asc" && <ChevronUp size={12} />}
                      {active && dir === "desc" && <ChevronDown size={12} />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={`divide-y ${tbody}`}>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-slate-400">{emptyText}</td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const onClick = rowClick ? () => rowClick(row) : undefined;
                return (
                  <tr
                    key={row._id ?? row.id ?? row._idx ?? idx}
                    className={`${rowBg} ${onClick ? "cursor-pointer" : ""}`}
                    onClick={onClick}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`whitespace-nowrap px-4 py-2.5 align-middle ${col.align === "right" ? "text-right" : "text-left"} ${rowText}`}
                      >
                        {typeof col.render === "function" ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
