// src/pages/ReturnsPage.jsx
// Refunds: give items back from a sale. Stock goes back up,
// and the money back is worked out from the sale's own prices.
// A list of past returns, plus a "New Return" form.
// The backend recomputes the refund from the sale's stored prices
// and caps the quantity at what was sold, so the form only sends
// { sale, items:[{product, quantity}], reason }.

import { useEffect, useState } from "react";
import { RotateCcw, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import api, { errorMessage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

// Money string from the store currency, e.g. "Rs 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ReturnsPage() {
  const { user } = useAuth();
  const role = user ? user.role : "";
  // Only admin and stock process returns (the backend enforces this too).
  const canCreate = ["admin", "stock"].includes(role);

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("LKR");

  const [sales, setSales] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [qtys, setQtys] = useState({}); // { [productId]: returnQty }
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Load everything once: returns, sales, currency.
  useEffect(() => {
    (async () => {
      try {
        const [r, s, cfg] = await Promise.all([
          api.get("/returns"),
          api.get("/sales"),
          api.get("/settings"),
        ]);
        setReturns(r.data);
        // Only finished sales that have not been refunded can be returned.
        setSales(s.data.filter((x) => x.status === "completed"));
        setCurrency(cfg.data.currency || "LKR");
        setError("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // The sale currently picked in the form.
  const selectedSale = sales.find((s) => s._id === saleId);

  // When the picked sale changes, reset the quantity boxes to 0.
  function changeSale(id) {
    setSaleId(id);
    setQtys({});
  }

  function changeQty(productId, value) {
    setQtys((q) => ({ ...q, [productId]: value }));
  }

  // Refund preview from the sale's own prices.
  const refund = selectedSale
    ? selectedSale.items.reduce(
        (sum, it) => sum + it.price * Number(qtys[it.product] || 0),
        0
      )
    : 0;

  async function submit() {
    if (!saleId) {
      toast.warning("Pick a sale");
      return;
    }
    const send = selectedSale.items
      .filter((it) => Number(qtys[it.product] || 0) > 0)
      .map((it) => ({ product: it.product, quantity: Number(qtys[it.product]) }));
    if (send.length === 0) {
      toast.warning("Enter a quantity for at least one item");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/returns", {
        sale: saleId,
        items: send,
        reason,
      });
      toast.success(`Refund of ${money(res.data.refundAmount, currency)} processed`);
      setShowForm(false);
      setSaleId("");
      setQtys({});
      setReason("");
      // Re-fetch both the returns list and the sales list (a sale may
      // now be marked refunded and should leave the picker).
      const [r, s] = await Promise.all([api.get("/returns"), api.get("/sales")]);
      setReturns(r.data);
      setSales(s.data.filter((x) => x.status === "completed"));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* New return button */}
      <div className="flex justify-end">
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <RotateCcw size={16} /> New Return
          </button>
        )}
      </div>

      {/* New return form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <RotateCcw size={20} className="text-indigo-600" /> New Return
          </h2>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Sale *</span>
            <select
              value={saleId}
              onChange={(e) => changeSale(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select a sale…</option>
              {sales.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.invoiceNo} — {money(s.total, currency)}
                </option>
              ))}
            </select>
          </label>

          {selectedSale && (
            <>
              {/* Return quantity per item */}
              <div className="mt-5 space-y-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-3 text-right">Sold</div>
                  <div className="col-span-3 text-right">Return qty</div>
                </div>

                {selectedSale.items.map((it) => (
                  <div key={it._id} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-6 text-sm text-slate-700">{it.name}</div>
                    <div className="col-span-3 text-right text-sm text-slate-500">
                      {it.quantity} × {money(it.price, currency)}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        max={it.quantity}
                        value={qtys[it.product] || 0}
                        onChange={(e) => changeQty(it.product, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Refund preview + reason */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Refund</div>
                  <div className="mt-1 text-2xl font-bold text-slate-800">
                    {money(refund, currency)}
                  </div>
                </div>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-slate-600">Reason</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional reason"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>
            </>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Processing…" : "Process Return"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Return list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Returns</h2>
        </div>

        {loading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading returns…</p>
        ) : error ? (
          <p className="px-6 py-6 text-sm text-rose-600">Could not load returns: {error}</p>
        ) : returns.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No returns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Sale</th>
                  <th className="px-6 py-3 text-right">Refund</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {r.sale ? r.sale.invoiceNo : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">
                      {money(r.refundAmount, currency)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{r.reason || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
