// src/pages/CustomersPage.jsx
// The customer book: a searchable list, plus add and edit forms.
// Delete is admin-only (the backend enforces this too).

import { useEffect, useState } from "react";
import { Users, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "react-toastify";
import api, { errorMessage } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Table from "../components/ui/Table";

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
    <div className="space-y-4">
      {/* Search + add button row */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            icon={<Search size={18} />}
            hint="Search name, phone, or email…"
            onChange={(e) => setSearch(e.target.value)}
            value={search}
            className="sm:w-72"
          />
          {canCreate && (
            <Button iconLeft={<Plus size={16} />}>Add Customer</Button>
          )}
        </div>
      </Card>

      {/* Add / edit form card */}
      {form && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
            <Users size={18} className="text-indigo-600" />
            {form._editing ? "Edit Customer" : "New Customer"}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Name *"
              icon={<Users size={18} />}
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => field("phone", e.target.value)}
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(e) => field("email", e.target.value)}
            />
            <Input
              label="Address"
              className="sm:col-span-2"
              value={form.address}
              onChange={(e) => field("address", e.target.value)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : form._editing ? "Save Changes" : "Add Customer"}
            </Button>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Customer table */}
      <Table
        title="Customers"
        rows={customers}
        columns={[
          {
            key: "name",
            header: "Name",
            render: (c) => (
              <span className="flex items-center gap-2">
                <Users size={15} className="text-slate-400" />
                {c.name}
              </span>
            ),
          },
          { key: "phone", header: "Phone", render: (c) => c.phone || "—" },
          { key: "email", header: "Email", render: (c) => c.email || "—" },
          { key: "address", header: "Address", render: (c) => c.address || "—" },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (c) => (
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
            ),
          },
        ]}
        emptyText="No customers found."
      />
    </div>
  );
}
