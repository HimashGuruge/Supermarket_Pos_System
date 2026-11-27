// src/pages/SettingsPage.jsx
// Store-wide settings. Sections:
//   - Store identity: name, address, phone, currency symbol.
//   - Logo: file upload (replaces the old file on the server).
//   - Tax & pricing: tax rate and the default discount.
//   - Receipt: the footer line printed on every receipt.
//   - Stock: the low-stock alert threshold.
//
// Only an admin can save (the backend enforces this too); other
// roles can view the values but the Save button is hidden.

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Store, Image, Percent, Receipt, Package, Save, Upload } from "lucide-react";
import api, { errorMessage, apiOrigin } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user ? user.role === "admin" : false;

  // The loaded settings document. null = not loaded yet.
  const [settings, setSettings] = useState(null);
  // The editable copy. We edit this and send it on Save, so a
  // half-typed form can never be lost by an accidental re-fetch.
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null); // the chosen image
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // Load the settings once.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/settings");
        if (active) {
          const s = res.data;
          setSettings(s);
          setForm({
            storeName: s.storeName || "",
            address: s.address || "",
            phone: s.phone || "",
            currency: s.currency || "",
            taxRate: s.taxRate ?? 0,
            discountDefault: s.discountDefault ?? 0,
            receiptFooter: s.receiptFooter || "",
            lowStockThreshold: s.lowStockThreshold ?? 5,
          });
        }
      } catch (err) {
        toast.error(errorMessage(err));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function field(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Pick a logo file. We keep the File object and upload it on Save.
  function onPickLogo(e) {
    const f = e.target.files && e.target.files[0];
    if (f) setLogoFile(f);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  }

  // Send the form + (optional) logo to the backend.
  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      // 1. Save the text/number fields.
      await api.put("/settings", {
        storeName: form.storeName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        currency: form.currency.trim(),
        taxRate: Number(form.taxRate) || 0,
        discountDefault: Number(form.discountDefault) || 0,
        receiptFooter: form.receiptFooter.trim(),
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
      });

      // 2. Upload the new logo if one was chosen.
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        await api.post("/settings/logo", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setLogoFile(null);
      }

      // 3. Re-read the saved document so the logo URL is fresh.
      const res = await api.get("/settings");
      setSettings(res.data);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!form) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <p className="text-gray-600">Loading settings…</p>
      </div>
    );
  }

  const logoUrl = settings && settings.logo;

  return (
    <div className="space-y-4">
      {/* Store identity */}
      <Card title="Store Identity" icon={Store}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Store Name *"
            value={form.storeName}
            onChange={(e) => field("storeName", e.target.value)}
          />
          <Input
            label="Currency Symbol"
            hint="Shown on receipts, e.g. LKR"
            value={form.currency}
            onChange={(e) => field("currency", e.target.value)}
          />
          <Input
            label="Address"
            className="sm:col-span-2"
            hint="Printed on the receipt header"
            value={form.address}
            onChange={(e) => field("address", e.target.value)}
          />
          <Input
            label="Phone"
            hint="Printed on the receipt header"
            value={form.phone}
            onChange={(e) => field("phone", e.target.value)}
          />
        </div>
      </Card>

      {/* Logo */}
      <Card title="Store Logo" icon={Image}>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-surface">
            {logoUrl ? (
              <img
                src={apiOrigin + logoUrl}
                alt="Store logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <Image size={36} className="text-slate-300" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              PNG, JPG, GIF, WEBP or SVG, max 2 MB. Replaces the current logo.
            </p>
            <input
              id="logo-file"
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={onPickLogo}
              className="sr-only"
            />
            <label
              htmlFor="logo-file"
              className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Upload size={16} />
              Choose logo
            </label>
            {logoFile && (
              <p className="text-xs font-medium text-indigo-600">
                {logoFile.name} ({Math.round(logoFile.size / 1024)} KB)
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Tax & pricing */}
      <Card title="Tax & Pricing" icon={Percent}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Tax Rate (%)"
            type="number"
            min="0"
            max="100"
            step="0.5"
            hint="Applied to every sale. 0 = tax off."
            value={form.taxRate}
            onChange={(e) => field("taxRate", e.target.value)}
          />
          <Input
            label="Default Discount (%)"
            type="number"
            min="0"
            max="100"
            step="0.5"
            hint="Pre-filled in the cart discount field."
            value={form.discountDefault}
            onChange={(e) => field("discountDefault", e.target.value)}
          />
        </div>
      </Card>

      {/* Receipt */}
      <Card title="Receipt" icon={Receipt}>
        <Input
          label="Footer Line"
          hint="Printed at the bottom of every receipt."
          value={form.receiptFooter}
          onChange={(e) => field("receiptFooter", e.target.value)}
        />
      </Card>

      {/* Stock */}
      <Card title="Stock" icon={Package}>
        <Input
          label="Low-Stock Threshold"
          type="number"
          min="0"
          step="1"
          hint="Products at or below this quantity raise a low-stock alert."
          value={form.lowStockThreshold}
          onChange={(e) => field("lowStockThreshold", e.target.value)}
        />
      </Card>

      {/* Save (admin only) */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            iconLeft={<Save size={16} />}
            onClick={save}
            loading={saving}
            disabled={!form.storeName.trim()}
          >
            Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}
