import { useEffect, useState } from "react";
import {
  Banknote,
  Package,
  Users,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import api, { errorMessage } from "../lib/api";

// Build a money string from the store's currency, e.g. "Rs 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// A small label + big number card. `tone` picks the accent colour.
function StatCard({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    sky: "bg-sky-50 text-sky-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${tones[tone] || tones.indigo}`}>
          <Icon size={20} />
        </div>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function statusStyle(status) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "cancelled") return "bg-slate-100 text-slate-600";
  return "bg-rose-100 text-rose-700";
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null); // /dashboard/stats object
  const [daily, setDaily] = useState([]); // [{ label, value }]
  const [topProducts, setTopProducts] = useState([]); // [{ name, units }]
  const [currency, setCurrency] = useState("LKR");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        // All three dashboard calls go out together, plus the currency.
        const [s, d, t, cfg] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/dashboard/daily-sales?days=7"),
          api.get("/dashboard/top-products?limit=5"),
          api.get("/settings"),
        ]);
        setStats(s.data);
        setDaily(d.data);
        setTopProducts(t.data);
        setCurrency(cfg.data.currency || "LKR");
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Could not load the dashboard: {error}
      </div>
    );
  }

  // Guard against a missing object so the page never crashes.
  if (!stats) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No data yet. Make a sale to see the dashboard fill in.
      </div>
    );
  }

  const maxSales = Math.max(...daily.map((d) => d.value), 1);
  const maxSold = Math.max(...topProducts.map((p) => p.units), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Banknote}
          label="Today's Sales"
          value={money(stats.todayRevenue, currency)}
          sub={`${stats.todayOrders} order${stats.todayOrders === 1 ? "" : "s"} today`}
          tone="green"
        />
        <StatCard
          icon={Receipt}
          label="Total Revenue"
          value={money(stats.totalRevenue, currency)}
          sub="All completed sales"
          tone="indigo"
        />
        <StatCard
          icon={Package}
          label="Products"
          value={stats.productCount}
          sub="Active products"
          tone="sky"
        />
        <StatCard
          icon={Users}
          label="Customers"
          value={stats.customerCount}
          sub="Saved customers"
          tone="indigo"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={stats.lowStockCount}
          sub="At or below minimum"
          tone={stats.lowStockCount > 0 ? "rose" : "amber"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              Sales — Last 7 Days
            </h2>
            <span className="text-sm text-slate-500">
              {money(stats.todayRevenue, currency)} today
            </span>
          </div>
          <div className="flex h-48 items-end justify-between gap-3">
            {daily.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-indigo-500 transition-colors hover:bg-indigo-600"
                    style={{ height: `${(d.value / maxSales) * 100}%` }}
                    title={`${money(d.value, currency)}`}
                  />
                </div>
                <span className="text-xs text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Top Products
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No products sold yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {topProducts.map((p) => (
                <li key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="text-slate-500">{p.units} sold</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(p.units / maxSold) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent sales */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">Recent Sales</h2>
        </div>
        {stats.recent.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            No sales yet. Complete a sale in the POS to see it here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recent.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {o.invoiceNo}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {o.customer ? o.customer.name : "Walk-in"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {o.cashier ? o.cashier.name : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">
                      {money(o.total, currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(
                          o.status
                        )}`}
                      >
                        {o.status}
                      </span>
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
