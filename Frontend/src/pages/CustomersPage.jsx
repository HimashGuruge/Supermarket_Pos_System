// src/pages/CustomersPage.jsx
// The customer book: a searchable list, plus add and edit forms.
// Delete is admin-only (the backend enforces this too).

import { useEffect, useState } from "react";
import { Users, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "react-toastify";
import api, { errorMessage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

// The fields in the add/edit form. Starts empty for a new customer.
function emptyForm() {
  return { name: "", phone: "", email: "", address: "" };
}

export default function CustomersPage() {
  const { user } = useAuth();
  const role = user ? user.role : "";

  // "Who" can do what here (the backend double-checks these):
  const canCreate = ["admin", "cashier", "stock"].includes(role);
  const canEdit = ["admin", "stock"].includes(role);
  const canDelete = role === "admin";

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // null = form closed. {} or a customer = form open (add or edit).
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load the list. Runs on first load, and again whenever the
  // search text changes (a small 300ms pause so we do not ask the
  // API on every key press).
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/customers", { params: { search } });
        if (active) setCustomers(res.data);
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
  }, [search]);

  // Read one customer back from the list when the user clicks Edit,
  // so the form is filled with their details.
  function startEdit(c) {
    setForm({ ...c, _editing: true });
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
    if (!form.name.trim()) {
      toast.warning("Name is required");
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      phone: form.phone || "",
      email: form.email || "",
      address: form.address || "",
    };
    try {
      if (form._editing) {
        await api.put("/customers/" + form._id, body);
        toast.success("Customer updated");
      } else {
        await api.post("/customers", body);
        toast.success("Customer added");
      }
      setForm(null);
      // Re-fetch so the table is fresh.
      setSearch(search);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Delete with a confirm, admin only.
  async function remove(c) {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try {
      await api.delete("/customers/" + c._id);
      toast.success("Customer deleted");
      setSearch(search);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      {/* Search + add button row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {canCreate && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus size={16} /> Add Customer
          </button>
        )}
      </div>

      {/* Add / edit form card */}
      {form && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Users size={20} className="text-indigo-600" />
            {form._editing ? "Edit Customer" : "New Customer"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Name *</span>
              <input
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => field("phone", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Email</span>
              <input
                value={form.email}
                onChange={(e) => field("email", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">Address</span>
              <input
                value={form.address}
                onChange={(e) => field("address", e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : form._editing ? "Save Changes" : "Add Customer"}
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

      {/* Customer table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Customers</h2>
        </div>

        {loading ? (
          <p className="px-6 py-6 text-sm text-slate-500">Loading customers…</p>
        ) : error ? (
          <p className="px-6 py-6 text-sm text-rose-600">Could not load customers: {error}</p>
        ) : customers.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">No customers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Address</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-700">{c.name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.phone || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{c.email || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{c.address || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => startEdit(c)}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                            title="Edit"
                          >
                            <Pencil size={15} /> Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => remove(c)}
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
