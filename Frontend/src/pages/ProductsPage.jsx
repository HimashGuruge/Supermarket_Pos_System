// src/pages/ProductsPage.jsx
// The product book: a searchable list, plus add and edit forms.
// Add/edit are for admin and stock (the backend enforces this too);
// delete is admin only.
//
// Fields in the form: name, barcode (unique), category, purchasePrice,
// salePrice, stock, minStock.

import { useEffect, useState } from "react";
import { Package, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "react-toastify";
import api, { errorMessage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

// Money string from the store currency, e.g. "LKR 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Stock badge color: green = fine, amber = low, red = out.
function stockStyle(status) {
  if (status === "In stock") return "bg-emerald-100 text-emerald-700";
  if (status === "Low stock") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

// Work out the stock badge from the numbers.
// "Out of stock" at 0, "Low stock" at or below minStock, else "In stock".
function statusOf(p) {
  if (p.stock <= 0) return "Out of stock";
  if (p.stock <= p.minStock) return "Low stock";
  return "In stock";
}

// The fields in the add/edit form. Starts empty for a new product.
function emptyForm() {
  return {
    name: "",
    barcode: "",
    category: "",
    purchasePrice: "",
    salePrice: "",
    stock: "0",
    minStock: "5",
  };
}

export default function ProductsPage() {
  const { user } = useAuth();
  const role = user ? user.role : "";

  // "Who" can do what here (the backend double-checks these):
  const canCreate = ["admin", "stock"].includes(role);
  const canEdit = ["admin", "stock"].includes(role);
  const canDelete = role === "admin";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [currency, setCurrency] = useState("LKR");
  const [search, setSearch] = useState("");
  // Bumped after every save/delete to force a fresh fetch, even when
  // the search text has not changed.
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // null = form closed. {} or a product = form open (add or edit).
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load the product list (and the currency). Runs on first load,
  // and again whenever the search text changes (300ms pause so we
  // do not ask the API on every key press).
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const [pr, cfg] = await Promise.all([
          api.get("/products", { params: { search } }),
          api.get("/settings"),
        ]);
        if (active) {
          setProducts(pr.data);
          setCurrency(cfg.data.currency || "LKR");
        }
        setError("");
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, refresh]);

  // Load the category list once, for the dropdown in the form.
  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  function startEdit(p) {
    // Pull the category id out of the populated object, so the
    // dropdown is filled with the right choice.
    setForm({
      _id: p._id,
      name: p.name,
      barcode: p.barcode,
      category: typeof p.category === "object" && p.category ? p.category._id : "",
      purchasePrice: String(p.purchasePrice ?? ""),
      salePrice: String(p.salePrice ?? ""),
      stock: String(p.stock ?? "0"),
      minStock: String(p.minStock ?? "5"),
      _editing: true,
    });
  }

  function startAdd() {
    setForm(emptyForm());
  }

  function closeForm() {
    setForm(null);
  }

  function field(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Send the form to the backend: create if new, update if editing.
  async function save() {
    // Check the required fields before sending.
    if (!form.name.trim()) {
      toast.warning("Name is required");
      return;
    }
    if (!form.barcode.trim()) {
      toast.warning("Barcode is required");
      return;
    }
    if (!form.category) {
      toast.warning("Category is required");
      return;
    }
    const purchasePrice = Number(form.purchasePrice);
    const salePrice = Number(form.salePrice);
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      toast.warning("Purchase price must be a number");
      return;
    }
    if (isNaN(salePrice) || salePrice < 0) {
      toast.warning("Sale price must be a number");
      return;
    }
    const stock = Number(form.stock);
    if (isNaN(stock) || stock < 0) {
      toast.warning("Stock must be a number");
      return;
    }
    const minStock = Number(form.minStock);
    if (isNaN(minStock) || minStock < 0) {
      toast.warning("Minimum stock must be a number");
      return;
    }

    setSaving(true);
    const body = {
      name: form.name.trim(),
      barcode: form.barcode.trim(),
      category: form.category,
      purchasePrice,
      salePrice,
      stock,
      minStock,
    };
    try {
      if (form._editing) {
        await api.put("/products/" + form._id, body);
        toast.success("Product updated");
      } else {
        await api.post("/products", body);
        toast.success("Product added");
      }
      setForm(null);
      // Bump the counter so the table re-fetches (even if the search
      // text has not changed).
      setRefresh(refresh + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Delete with a confirm, admin only.
  async function remove(p) {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    try {
      await api.delete("/products/" + p._id);
      toast.success("Product deleted");
      setRefresh(refresh + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  // Shared input style for the form fields.
  const inputCls =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="space-y-6">
      {/* Search + add button row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, barcode, SKU…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {canCreate && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      {/* Add / edit form card */}
      {form && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Package size={20} className="text-indigo-600" />
            {form._editing ? "Edit Product" : "New Product"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Name *</span>
              <input
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Barcode *</span>
              <input
                value={form.barcode}
                onChange={(e) => field("barcode", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Category *</span>
              <select
                value={form.category}
                onChange={(e) => field("category", e.target.value)}
                className={inputCls}
              >
                <option value="">— pick a category —</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Purchase Price (cost) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => field("purchasePrice", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Sale Price (shelf) *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => field("salePrice", e.target.value)}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">Stock</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => field("stock", e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">Min Stock</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(e) => field("minStock", e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : form._editing ? "Save Changes" : "Add Product"}
            </button>
            <button
              onClick={closeForm}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Products</h2>
        </div>

        {loading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading products…</p>
        ) : error ? (
          <p className="px-6 py-6 text-sm text-rose-600">
            Could not load products: {error}
          </p>
        ) : products.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3 text-right">Stock</th>
                  <th className="px-6 py-3 text-right">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-700">{p.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.category ? p.category.name : "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {money(p.salePrice, currency)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">{p.stock}</td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockStyle(statusOf(p))}`}
                      >
                        {statusOf(p)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => startEdit(p)}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                            title="Edit"
                          >
                            <Pencil size={15} /> Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => remove(p)}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
                            title="Delete"
                          >
                            <Trash2 size={15} /> Delete
                          </button>
                        )}
                      </div>
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
