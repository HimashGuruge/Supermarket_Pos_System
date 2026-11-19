// src/pages/SalesHistoryPage.jsx
// Past sales: a list of every sale, newest first.
//   - A date picker filters the list to one day (the API does the filter).
//   - Clicking a row opens a receipt view with all the line items.
//   - Admin and stock can cancel a completed sale (gives the stock back;
//     the backend enforces this too).
//
// API used (see Backend/routes/sales.js):
//   GET  /api/sales?date=YYYY-MM-DD   list
//   GET  /api/sales/:id               one sale (not needed: list already has items)
//   POST /api/sales/:id/cancel        cancel + restore stock

import { useEffect, useState } from "react";
import { Receipt, X, Ban, CalendarDays, Printer } from "lucide-react";
import { toast } from "react-toastify";
import api, { errorMessage } from "../lib/api";
import { printReceipt } from "../lib/printReceipt";
import { useAuth } from "../contexts/AuthContext";

// Money string from the store's currency, e.g. "LKR 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Small coloured pill for a sale's status.
function statusStyle(status) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "refunded") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700"; // cancelled
}

export default function SalesHistoryPage() {
  const { user } = useAuth();
  const role = user ? user.role : "";
  // Only admin and stock can cancel (the backend enforces this too).
  const canCancel = ["admin", "stock"].includes(role);

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("LKR");
  const [settings, setSettings] = useState(null);

  // The day the list is filtered to ("YYYY-MM-DD"), or "" for all.
  const [date, setDate] = useState("");

  // The sale shown in the receipt modal, or null.
  const [selected, setSelected] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Load the sales list. Runs whenever the date filter changes.
  useEffect(() => {
    (async () => {
      try {
        const params = date ? { date } : {};
        const [list, cfg] = await Promise.all([
          api.get("/sales", { params }),
          api.get("/settings"),
        ]);
        setSales(list.data);
        setCurrency(cfg.data.currency || "LKR");
        setSettings(cfg.data);
        setError("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  // Cancel the selected sale. The stock goes back on the backend.
  async function cancel() {
    if (!selected) return;
    // A plain confirm box so the user does not cancel by accident.
    const ok = window.confirm(
      `Cancel ${selected.invoiceNo}? The stock will be given back.`
    );
    if (!ok) return;
    setCancelling(true);
    try {
      await api.post(`/sales/${selected._id}/cancel`);
      toast.success(`${selected.invoiceNo} cancelled`);
      setSelected(null);
      // Re-fetch so the row shows the new status.
      const params = date ? { date } : {};
      const list = await api.get("/sales", { params });
      setSales(list.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  // Print the selected sale using the shared receipt helper.
  function print() {
    if (!selected || !settings) return;
    // The helper wants money(n) with the currency baked in.
    const moneyFn = (n) => money(n, currency);
    if (!printReceipt(selected, settings, moneyFn)) {
      toast.error("Please allow pop-ups to print the receipt");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header: title + date filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Receipt size={20} className="text-indigo-600" /> Sales History
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays size={16} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          {date && (
            <button
              onClick={() => setDate("")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              All dates
            </button>
          )}
        </div>
      </div>

      {/* Sales list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {date
              ? `Sales on ${new Date(date + "T00:00:00").toLocaleDateString()}`
              : "All sales"}
          </h3>
        </div>

        {loading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading sales…</p>
        ) : error ? (
          <p className="px-6 py-6 text-sm text-rose-600">
            Could not load sales: {error}
          </p>
        ) : sales.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            No sales found for this date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Date &amp; time</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3 text-right">Items</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => {
                  const qty = s.items.reduce((sum, it) => sum + it.quantity, 0);
                  return (
                    <tr
                      key={s._id}
                      onClick={() => setSelected(s)}
                      className="cursor-pointer hover:bg-slate-50"
                      title="Click to view the receipt"
                    >
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {s.invoiceNo}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(s.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.customer ? s.customer.name : "Walk-in"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.cashier ? s.cashier.name : "—"}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">
                        {qty}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.paymentMethod}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700">
                        {money(s.total, currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                            s.status
                          )}`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                Receipt
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sale meta */}
            <p className="mt-1 text-sm text-slate-500">
              {selected.invoiceNo} ·{" "}
              {new Date(selected.createdAt).toLocaleString()}
            </p>
            <p className="text-sm text-slate-500">
              Customer: {selected.customer ? selected.customer.name : "Walk-in"}{" "}
              · Cashier: {selected.cashier ? selected.cashier.name : "—"}
            </p>

            {/* Line items */}
            <div className="mt-4 space-y-2">
              {selected.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">
                    {it.name} <span className="text-slate-400">× {it.quantity}</span>
                  </span>
                  <span className="text-slate-700">{money(it.lineTotal, currency)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{money(selected.subtotal, currency)}</span>
              </div>
              {selected.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount</span>
                  <span>− {money(selected.discount, currency)}</span>
                </div>
              )}
              {selected.tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>{money(selected.tax, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-800">
                <span>Total</span>
                <span>{money(selected.total, currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid ({selected.paymentMethod})</span>
                <span>{money(selected.cashReceived, currency)}</span>
              </div>
              {selected.paymentMethod === "cash" && selected.balance > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Change</span>
                  <span>{money(selected.balance, currency)}</span>
                </div>
              )}
            </div>

            {/* Status + actions */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                  selected.status
                )}`}
              >
                {selected.status}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={print}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Printer size={15} />
                  Print
                </button>
                {canCancel && selected.status === "completed" && (
                  <button
                    onClick={cancel}
                    disabled={cancelling}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Ban size={15} />
                    {cancelling ? "Cancelling…" : "Cancel sale"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
