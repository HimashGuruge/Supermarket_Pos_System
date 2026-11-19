// src/pages/PosPage.jsx
// The billing screen. A cashier sits here all shift.
//
// Layout:
//   LEFT  — search box + product grid. Click a product to add one.
//           A hidden, always-focused input also reads USB barcode
//           scanners (they type fast and send an Enter key).
//   RIGHT — the cart. Edit quantities, add a discount, choose cash or
//           card, enter cash received to see the change owed, and
//           press "Complete sale".
//
// After the sale succeeds, a receipt pops open for printing.
// The backend has already reduced stock and saved the sale, so the
// receipt is just a pretty view of real data.

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Printer,
  X,
} from "lucide-react";
import api, { errorMessage } from "../lib/api";
import { printReceipt as printReceiptShared } from "../lib/printReceipt";

export default function PosPage() {
  // ---- Products -------------------------------------------------------
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pError, setPError] = useState("");

  // ---- Cart -----------------------------------------------------------
  const [cart, setCart] = useState([]); // [{ product, quantity }]
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");

  // ---- Store settings (currency, tax, name) --------------------------
  const [settings, setSettings] = useState({
    currency: "LKR",
    taxRate: 0,
    storeName: "Supermart",
    receiptFooter: "Thank you for shopping!",
  });

  // ---- Completing a sale ---------------------------------------------
  const [busy, setBusy] = useState(false);

  // ---- Receipt --------------------------------------------------------
  const [receipt, setReceipt] = useState(null); // the full sale to print

  // ---- Search + barcode scanner --------------------------------------
  const [query, setQuery] = useState("");
  const scanRef = useRef(null); // hidden barcode input

  // Money helper: uses the store's currency unit.
  function money(n) {
    return (settings.currency || "LKR") + " " + (Number(n) || 0).toFixed(2);
  }

  // Load products and settings once when the page opens.
  // We also re-load products after every sale so stock stays fresh.
  async function loadProducts() {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
      setPError("");
    } catch (err) {
      setPError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  async function loadSettings() {
    try {
      const res = await api.get("/settings");
      if (res.data) setSettings(res.data);
    } catch {
      // Settings failing is not fatal for billing; keep defaults.
    }
  }
  useEffect(() => {
    (async () => {
      await Promise.all([loadProducts(), loadSettings()]);
    })();
  }, []);

  // Keep the hidden barcode input focused at all times, so a scan
  // works no matter which box the cashier is looking at.
  useEffect(() => {
    const focusScan = () => scanRef.current && scanRef.current.focus();
    focusScan();
    window.addEventListener("focus", focusScan);
    return () => window.removeEventListener("focus", focusScan);
  }, []);

  // What the grid shows: filter the full list by the search text.
  const visible = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode || "").includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
    );
  }, [products, query]);

  // ---- Cart actions ---------------------------------------------------
  function addToCart(product) {
    setCart((prev) => {
      const found = prev.find((i) => i.product._id === product._id);
      if (found) {
        return prev.map((i) =>
          i.product._id === product._id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }
  function changeQty(id, delta) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product._id === id ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }
  function setQty(id, qty) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product._id !== id));
    } else {
      setCart((prev) =>
        prev.map((i) => (i.product._id === id ? { ...i, quantity: qty } : i))
      );
    }
  }
  function clearCart() {
    setCart([]);
    setDiscount(0);
    setCashReceived("");
    setPaymentMethod("cash");
  }

  // Barcode: scanner types a code fast then sends Enter.
  // On Enter we look up the exact barcode and add one unit.
  function onScanKey(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanRef.current.value.trim();
    scanRef.current.value = "";
    if (!code) return;
    const match = products.find((p) => p.barcode === code);
    if (match) {
      addToCart(match);
      toast.success("Scanned: " + match.name);
    } else {
      toast.error("No product with barcode " + code);
    }
  }

  // ---- Totals ---------------------------------------------------------
  const subtotal = cart.reduce(
    (sum, i) => sum + i.product.salePrice * i.quantity,
    0
  );
  const tax = ((subtotal - discount) * settings.taxRate) / 100;
  const total = subtotal - discount + tax;
  const change =
    paymentMethod === "cash"
      ? Math.max(0, (Number(cashReceived) || 0) - total)
      : 0;
  const cashShort =
    paymentMethod === "cash" && cashReceived !== ""
      ? Number(cashReceived) - total
      : 0;

  // ---- Complete the sale --------------------------------------------
  async function completeSale() {
    if (cart.length === 0) {
      toast.warning("The cart is empty");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/sales", {
        items: cart.map((i) => ({ product: i.product._id, quantity: i.quantity })),
        discount: Number(discount) || 0,
        paymentMethod,
        cashReceived: Number(cashReceived) || 0,
        customer: null,
        taxRate: settings.taxRate || 0,
      });
      // Fetch the populated sale (with cashier + customer names)
      // so the receipt reads cleanly.
      const full = await api.get("/sales/" + res.data._id);
      setReceipt(full.data);
      clearCart();
      loadProducts(); // refresh stock after the sale
      toast.success("Sale " + res.data.invoiceNo + " complete");
    } catch (err) {
      // 409 means not enough stock; the backend already rolled back.
      if (err.response && err.response.status === 409) {
        toast.error(errorMessage(err));
        loadProducts();
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- Receipt --------------------------------------------------------
  function printReceipt() {
    // Shared helper: opens the printer window and prints the sale.
    // Returns false when pop-ups are blocked, so we can warn the user.
    if (!printReceiptShared(receipt, settings, money)) {
      toast.error("Please allow pop-ups to print the receipt");
    }
  }

  // ---- Render ---------------------------------------------------------
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading POS…
      </div>
    );
  }
  if (pError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Could not load products: {pError}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Hidden barcode scanner input. It is always focused, so a USB
          scanner works from anywhere on the page. */}
      <input
        ref={scanRef}
        className="absolute -left-9999 h-0 w-0 opacity-0"
        aria-hidden="true"
        tabIndex={-1}
        onKeyDown={onScanKey}
      />

      {/* LEFT: search + product grid */}
      <div className="lg:col-span-2">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by name, barcode, or SKU…"
            className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            No products match "{query}".
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => {
              const low = p.stock <= p.minStock;
              return (
                <button
                  key={p._id}
                  onClick={() => addToCart(p)}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-sm"
                >
                  <span className="line-clamp-2 text-sm font-medium text-slate-800">
                    {p.name}
                  </span>
                  <span className="mt-1 text-base font-bold text-slate-900">
                    {money(p.salePrice)}
                  </span>
                  <span
                    className={`mt-1 text-xs ${
                      low ? "font-semibold text-rose-600" : "text-slate-400"
                    }`}
                  >
                    {p.stock} in stock
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: the cart */}
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <ShoppingCart size={18} /> Current Sale
            </h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-slate-500 hover:text-rose-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Items */}
          <div className="max-h-64 overflow-y-auto px-4 py-2">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Tap a product to add it.
              </p>
            ) : (
              <ul className="space-y-2">
                {cart.map((i) => (
                  <li key={i.product._id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {i.product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {money(i.product.salePrice)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => changeQty(i.product._id, -1)}
                        className="rounded bg-slate-100 p-1 text-slate-700 hover:bg-slate-200"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        value={i.quantity}
                        onChange={(e) =>
                          setQty(i.product._id, Number(e.target.value))
                        }
                        className="w-10 rounded border border-slate-200 py-1 text-center text-sm"
                      />
                      <button
                        onClick={() => changeQty(i.product._id, 1)}
                        className="rounded bg-slate-100 p-1 text-slate-700 hover:bg-slate-200"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => setQty(i.product._id, 0)}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Money + payment */}
          <div className="space-y-3 border-t border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-800">
                {money(subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">Discount</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                min="0"
                className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tax ({settings.taxRate || 0}%)</span>
              <span className="font-medium text-slate-800">{money(tax)}</span>
            </div>

            {/* Payment method */}
            <div className="flex gap-2">
              {["cash", "card"].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 rounded-lg border py-2 text-sm capitalize ${
                    paymentMethod === m
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Cash received + change (cash only) */}
            {paymentMethod === "cash" && (
              <>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Cash received</span>
                  <input
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    min="0"
                    placeholder="0"
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Change</span>
                  <span
                    className={`font-semibold ${
                      cashShort < 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {money(change)}
                    {cashShort < 0 ? " (short)" : ""}
                  </span>
                </div>
              </>
            )}

            {/* TOTAL */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-base font-semibold text-slate-800">
                Total
              </span>
              <span className="text-xl font-bold text-slate-900">
                {money(total)}
              </span>
            </div>

            <button
              onClick={completeSale}
              disabled={busy || cart.length === 0}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Complete sale"}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                Sale complete
              </h3>
              <button
                onClick={() => setReceipt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Invoice {receipt.invoiceNo} · {money(receipt.total)}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={printReceipt}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Printer size={16} /> Print receipt
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                New sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
