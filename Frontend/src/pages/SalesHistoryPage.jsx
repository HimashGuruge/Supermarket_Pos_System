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
import { Receipt, Ban, Printer } from "lucide-react";
import { toast } from "react-toastify";
import api, { errorMessage } from "../lib/api";
import { printReceipt } from "../lib/printReceipt";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";
import Modal from "../components/ui/Modal";

// Money string from the store's currency, e.g. "LKR 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Map a sale's status to a Badge tone.
function statusTone(status) {
  if (status === "completed") return "success";
  if (status === "refunded") return "warning";
  return "danger"; // cancelled
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
    <div className="space-y-4">
      {/* Header: title + date filter */}
      <Card title="Sales History" icon={<Receipt size={19} className="text-indigo-600" />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            {date ? (
              <p className="text-sm text-slate-500">
                Sales on {new Date(date + "T00:00:00").toLocaleDateString()}
              </p>
            ) : (
              <p className="text-sm text-slate-500">All sales</p>
            )}
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Sales list */}
      <Card className="p-3">
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
          <Table
            title={
              date
                ? `Sales on ${new Date(date + "T00:00:00").toLocaleDateString()}`
                : "All sales"
            }
            rows={sales}
            rowClick={(s) => setSelected(s)}
            columns={[
              {
                key: "invoiceNo",
                header: "Invoice",
                render: (s) => (
                  <span className="flex items-center gap-2">
                    <Receipt size={15} className="text-slate-400" />
                    {s.invoiceNo}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Date &amp; time",
                render: (s) => new Date(s.createdAt).toLocaleString(),
              },
              {
                key: "customer",
                header: "Customer",
                render: (s) => (s.customer ? s.customer.name : "Walk-in"),
              },
              {
                key: "cashier",
                header: "Cashier",
                render: (s) => (s.cashier ? s.cashier.name : "—"),
              },
              {
                key: "items",
                header: "Items",
                align: "right",
                render: (s) => s.items.reduce((sum, it) => sum + it.quantity, 0),
              },
              { key: "payment", header: "Payment", render: (s) => s.paymentMethod },
              {
                key: "total",
                header: "Total",
                align: "right",
                render: (s) => money(s.total, currency),
              },
              {
                key: "status",
                header: "Status",
                render: (s) => (
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                ),
              },
            ]}
            emptyText="No sales found for this date."
          />
        )}
      </Card>

      {/* Receipt modal */}
      {selected && (
        <Modal
          size="md"
          onClose={() => setSelected(null)}
          title="Receipt"
          className="max-h-[80vh] overflow-y-auto"
        >
          <div className="space-y-4">
            {/* Sale meta */}
            <p className="text-sm text-slate-500">
              {selected.invoiceNo} ·{" "}
              {new Date(selected.createdAt).toLocaleString()}
            </p>
            <p className="text-sm text-slate-500">
              Customer: {selected.customer ? selected.customer.name : "Walk-in"}{" "}
              · Cashier: {selected.cashier ? selected.cashier.name : "—"}
            </p>

            {/* Line items */}
            <div className="space-y-2">
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
            <div className="space-y-1 border-t border-slate-200 pt-4 text-sm">
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
            <div className="flex items-center justify-between gap-2">
              <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  iconLeft={<Printer size={15} />}
                  onClick={print}
                >
                  Print
                </Button>
                {canCancel && selected.status === "completed" && (
                  <Button
                    variant="danger"
                    iconLeft={<Ban size={15} />}
                    onClick={cancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling…" : "Cancel sale"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
