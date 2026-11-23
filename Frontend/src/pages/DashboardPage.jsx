import { useEffect, useState } from "react";
import {
  Banknote,
  Package,
  Users,
  AlertTriangle,
  Receipt,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import api, { errorMessage } from "../lib/api";
import Stat from "../components/ui/Stat";

// Build a money string from the store's currency, e.g. "Rs 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
      <div className="rounded-2xl border border-slate-200 bg-card p-6 text-sm text-slate-500 shadow-card">
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-card">
        Could not load the dashboard: {error}
      </div>
    );
  }

  // Guard against a missing object so the page never crashes.
  if (!stats) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-card p-6 text-sm text-slate-500 shadow-card">
        No data yet. Make a sale to see the dashboard fill in.
      </div>
    );
  }

  const maxSales = Math.max(...daily.map((d) => d.value), 1);
  const maxSold = Math.max(...topProducts.map((p) => p.units), 1);

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={Banknote}
          label="Today's Sales"
          value={money(stats.todayRevenue, currency)}
          subtitle={`${stats.todayOrders} order${
            stats.todayOrders === 1 ? "" : "s"
          } today`}
          tone="green"
        />
        <Stat
          icon={Receipt}
          label="Total Revenue"
          value={money(stats.totalRevenue, currency)}
          subtitle="All completed sales"
          tone="indigo"
        />
        <Stat
          icon={Package}
          label="Products"
          value={stats.productCount}
          subtitle="Active products"
          tone="blue"
        />
        <Stat
          icon={Users}
          label="Customers"
          value={stats.customerCount}
          subtitle="Saved customers"
          tone="indigo"
        />
        <Stat
          icon={AlertTriangle}
          label="Low Stock"
          value={stats.lowStockCount}
          subtitle="At or below minimum"
          tone={stats.lowStockCount > 0 ? "red" : "amber"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Sales chart */}
        <div className="rounded-2xl border border-slate-200 bg-card p-6 shadow-card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <TrendingUp size={17} className="text-indigo-600" />
              Sales — Last 7 Days
            </h2>
            <span className="text-sm text-slate-500">
              {money(stats.todayRevenue, currency)} today
            </span>
          </div>
          <div className="flex h-56 items-end justify-between gap-3">
            {daily.map((d) => (
              <div
                key={d.label}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-violet-500 transition-all hover:from-indigo-600 hover:to-violet-600"
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
        <div className="rounded-2xl border border-slate-200 bg-card p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            Top Products
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No products sold yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {topProducts.map((p) => (
                <li key={p.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.name}</span>
                    <span className="text-slate-500">{p.units} sold</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-card">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <ShoppingBag size={17} className="text-indigo-600" />
            Recent Sales
          </h2>
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
                  <th className="px-4 py-2.5">Invoice</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {stats.recent.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {o.invoiceNo}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {o.customer ? o.customer.name : "Walk-in"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {o.cashier ? o.cashier.name : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                      {money(o.total, currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
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
