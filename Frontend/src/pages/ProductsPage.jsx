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
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";

// Money string from the store currency, e.g. "LKR 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Map a stock status to a Badge tone: danger=Out, warning=Low, success=In.

// Work out the stock badge from the numbers.
// "Out of stock" at 0, "Low stock" at or below minStock, else "In stock".
function statusOf(p) {
  if (p.stock <= 0) return "Out of stock";
  if (p.stock <= p.minStock) return "Low stock";
  return "In stock";
}

// Map a stock status to a Badge tone: danger=Out, warning=Low, success=In.
function stockTone(status) {
  if (status === "Out of stock") return "danger";
  if (status === "Low stock") return "warning";
  return "success";
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

  // Form fields share the same rounded, indigo-focused Input style.
  return (
    <div className="space-y-4">
      {/* Search + add button row */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            icon={<Search size={18} />}
            hint="Search name, barcode, or SKU…"
            onChange={(e) => setSearch(e.target.value)}
            value={search}
            className="sm:w-72"
          />
          {canCreate && (
            <Button iconLeft={<Plus size={16} />}>Add Product</Button>
          )}
        </div>
      </Card>

      {/* Add / edit form card */}
      {form && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <Package size={18} className="text-indigo-600" />
            {form._editing ? "Edit Product" : "New Product"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Name *"
              icon={<Package size={18} />}
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
            <Input
              label="Barcode *"
              value={form.barcode}
              onChange={(e) => field("barcode", e.target.value)}
            />
            <Select
              label="Category *"
              value={form.category}
              onChange={(e) => field("category", e.target.value)}
            >
              <option value="">— pick a category —</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              label="Purchase Price (cost) *"
              type="number"
              min="0"
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => field("purchasePrice", e.target.value)}
            />
            <Input
              label="Sale Price (shelf) *"
              type="number"
              min="0"
              step="0.01"
              value={form.salePrice}
              onChange={(e) => field("salePrice", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Stock"
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => field("stock", e.target.value)}
              />
              <Input
                label="Min Stock"
                type="number"
                min="0"
                step="1"
                value={form.minStock}
                onChange={(e) => field("minStock", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : form._editing ? "Save Changes" : "Add Product"}
            </Button>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Product table */}
      <Table
        title="Products"
        rows={products}
        columns={[
          {
            key: "name",
            header: "Product",
            render: (p) => (
              <span className="flex items-center gap-2">
                <Package size={15} className="text-slate-400" />
                {p.name}
              </span>
            ),
          },
          {
            key: "category",
            header: "Category",
            render: (p) => (p.category ? p.category.name : "—"),
          },
          {
            key: "salePrice",
            header: "Price",
            align: "right",
            render: (p) => money(p.salePrice, currency),
          },
          {
            key: "stock",
            header: "Stock",
            align: "right",
            render: (p) => p.stock,
          },
          {
            key: "status",
            header: "Status",
            align: "right",
            render: (p) => (
              <Badge tone={stockTone(statusOf(p))}>{statusOf(p)}</Badge>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (p) => (
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
            ),
          },
        ]}
        emptyText="No products found."
      />
    </div>
  );
}
