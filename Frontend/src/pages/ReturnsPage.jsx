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
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Table from "../components/ui/Table";

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
    <div className="space-y-4">
      {/* New return button */}
      <Card className="px-3 py-2">
        <div className="flex justify-end">
          {canCreate && (
            <Button iconLeft={<RotateCcw size={16} />}>New Return</Button>
          )}
        </div>
      </Card>

      {/* New return form */}
      {showForm && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <RotateCcw size={18} className="text-indigo-600" /> New Return
          </h2>

          <Select
            label="Sale *"
            value={saleId}
            onChange={(e) => changeSale(e.target.value)}
          >
            <option value="">Select a sale…</option>
            {sales.map((s) => (
              <option key={s._id} value={s._id}>
                {s.invoiceNo} — {money(s.total, currency)}
              </option>
            ))}
          </Select>

          {selectedSale && (
            <>
              {/* Return quantity per item */}
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-3 text-right">Sold</div>
                  <div className="col-span-3 text-right">Return qty</div>
                </div>

                {selectedSale.items.map((it) => (
                  <div
                    key={it._id}
                    className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="col-span-6 text-sm text-slate-700">{it.name}</div>
                    <div className="col-span-3 text-right text-sm text-slate-500">
                      {it.quantity} × {money(it.price, currency)}
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        max={it.quantity}
                        value={qtys[it.product] || 0}
                        onChange={(e) => changeQty(it.product, e.target.value)}
                        className="w-full text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Refund preview + reason */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    Refund
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-800">
                    {money(refund, currency)}
                  </div>
                </div>
                <Input
                  label="Reason"
                  value={reason}
                  placeholder="Optional reason"
                  className="sm:col-span-2"
                />
              </div>
            </>
          )}

          <div className="mt-4 flex gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? "Processing…" : "Process Return"}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Return list */}
      <Table
        title="Returns"
        rows={returns}
        columns={[
          {
            key: "sale",
            header: "Sale",
            render: (r) =>
              r.sale ? (
                <span className="flex items-center gap-2">
                  <RotateCcw size={15} className="text-slate-400" />
                  {r.sale.invoiceNo}
                </span>
              ) : (
                "—"
              ),
          },
          {
            key: "refund",
            header: "Refund",
            align: "right",
            render: (r) => money(r.refundAmount, currency),
          },
          { key: "reason", header: "Reason", render: (r) => r.reason || "—" },
          {
            key: "date",
            header: "Date",
            align: "right",
            render: (r) => new Date(r.createdAt).toLocaleDateString(),
          },
        ]}
        emptyText="No returns yet."
      />
    </div>
  );
}
