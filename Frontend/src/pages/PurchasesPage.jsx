// src/pages/PurchasesPage.jsx
// Stock coming IN: receive stock from a supplier.
// A list of past purchases, plus a "New Purchase" form.
// The form sends { supplier, items:[{product, quantity, costPerUnit?}],
// paidAmount, notes }. costPerUnit is the actual cost per unit (pre-filled
// from the product's purchasePrice); when left blank the backend falls
// back to purchasePrice.

import { useEffect, useState } from "react";
import { PackagePlus, Plus, X } from "lucide-react";
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

function paymentStyle(status) {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "partial") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

// One row in the "New Purchase" item list.
// costPerUnit is pre-filled with the product's purchasePrice and can
// be overridden per row; the backend uses it as the actual cost.
function emptyItem() {
  return { product: "", quantity: 1, costPerUnit: "" };
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const role = user ? user.role : "";
  // Only admin and stock receive stock (the backend enforces this too).
  const canCreate = ["admin", "stock"].includes(role);

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [currency, setCurrency] = useState("LKR");

  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load everything once: purchases, suppliers, products, currency.
  useEffect(() => {
    (async () => {
      try {
        const [p, s, pr, cfg] = await Promise.all([
          api.get("/purchases"),
          api.get("/suppliers"),
          api.get("/products"),
          api.get("/settings"),
        ]);
        setPurchases(p.data);
        setSuppliers(s.data);
        setProducts(pr.data);
        setCurrency(cfg.data.currency || "LKR");
        setError("");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep product list sorted by name for the picker.
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  // Look up a product by id, used to preview its cost.
  function productById(id) {
    return products.find((p) => p._id === id);
  }

  function changeItem(index, key, value) {
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r))
    );
  }

  function addItem() {
    setItems((rows) => [...rows, emptyItem()]);
  }

  function removeItem(index) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  // The effective cost per unit: the entered value, or the product's
  // purchasePrice when the field is blank (the backend does the same).
  function costOf(it) {
    const p = productById(it.product);
    const entered = Number(it.costPerUnit);
    if (it.costPerUnit !== "" && Number.isFinite(entered) && entered >= 0) {
      return entered;
    }
    return p ? p.purchasePrice : 0;
  }

  // Total cost preview; the backend recomputes the real total.
  const total = items.reduce(
    (sum, it) => sum + costOf(it) * Number(it.quantity || 0),
    0
  );

  async function submit() {
    if (!supplier) {
      toast.warning("Pick a supplier");
      return;
    }
    const send = items.filter((it) => it.product && Number(it.quantity) > 0);
    if (send.length === 0) {
      toast.warning("Add at least one product with a quantity");
      return;
    }
    // A cost must be a non-negative number when it is provided.
    for (const it of send) {
      if (it.costPerUnit !== "") {
        const c = Number(it.costPerUnit);
        if (!Number.isFinite(c) || c < 0) {
          toast.error("Cost per unit must be zero or a positive amount");
          return;
        }
      }
    }
    setSaving(true);
    try {
      const res = await api.post("/purchases", {
        supplier,
        items: send.map((it) => ({
          product: it.product,
          quantity: Number(it.quantity),
          costPerUnit: it.costPerUnit === "" ? undefined : Number(it.costPerUnit),
        })),
        paidAmount: Number(paidAmount) || 0,
        notes,
      });
      toast.success(`Received ${res.data.invoiceNo}`);
      setShowForm(false);
      setSupplier("");
      setItems([emptyItem()]);
      setPaidAmount("");
      setNotes("");
      // Re-fetch the list so the new purchase shows.
      const p = await api.get("/purchases");
      setPurchases(p.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* New purchase button */}
      <div className="flex justify-end">
        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <PackagePlus size={16} /> New Purchase
          </button>
        )}
      </div>

      {/* New purchase form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <PackagePlus size={20} className="text-indigo-600" /> New Purchase
          </h2>

          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-600">Supplier *</span>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          {/* Item rows */}
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <div className="col-span-6">Product</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-3 text-right">Cost / unit</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((it, idx) => {
              const p = productById(it.product);
              return (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6">
                    <select
                      value={it.product}
                      onChange={(e) => {
                        const id = e.target.value;
                        const p = productById(id);
                        // Prefill the cost with the product's purchasePrice
                        // so a fresh row is correct without extra typing.
                        setItems((rows) =>
                          rows.map((r, i) =>
                            i === idx
                              ? {
                                  ...r,
                                  product: id,
                                  costPerUnit: p ? String(p.purchasePrice) : "",
                                }
                              : r
                          )
                        );
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Select a product…</option>
                      {sortedProducts.map((pr) => (
                        <option key={pr._id} value={pr._id}>
                          {pr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => changeItem(idx, "quantity", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div className="col-span-3 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.costPerUnit}
                      onChange={(e) => changeItem(idx, "costPerUnit", e.target.value)}
                      placeholder={p ? p.purchasePrice : "0.00"}
                      title="Actual cost per unit (defaults to the product's purchase price)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="text-rose-500 hover:text-rose-700 disabled:opacity-30"
                      title="Remove row"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              onClick={addItem}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Plus size={15} /> Add another product
            </button>
          </div>

          {/* Totals + payment */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Total cost</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{money(total, currency)}</div>
            </div>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Paid amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Receiving…" : "Receive Stock"}
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

      {/* Purchase list */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Purchases</h2>
        </div>

        {loading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading purchases…</p>
        ) : error ? (
          <p className="px-6 py-6 text-sm text-rose-600">Could not load purchases: {error}</p>
        ) : purchases.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Number</th>
                  <th className="px-6 py-3">Supplier</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Paid</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-700">{p.invoiceNo}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.supplier ? p.supplier.name : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">
                      {money(p.total, currency)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {money(p.paidAmount, currency)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStyle(
                          p.paymentStatus
                        )}`}
                      >
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(p.createdAt).toLocaleDateString()}
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
