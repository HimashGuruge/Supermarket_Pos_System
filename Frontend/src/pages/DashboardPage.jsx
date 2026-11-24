import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import api, { errorMessage } from "../lib/api";
import Badge from "../components/ui/Badge";
import Table from "../components/ui/Table";

// Build a money string from the store's currency, e.g. "Rs 56.00".
function money(n, currency) {
  return `${currency} ${(n || 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Compact axis numbers: 1234 -> "1.2k", 2000000 -> "2.0M".
function compact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(n));
}

// A small segmented control for the chart toggles.
function Segmented({ options, value, onChange, disabled = false }) {
  return (
    <div
      className={`flex items-center rounded-lg bg-slate-100 p-0.5 text-xs font-medium ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 transition ${
            value === o.value
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// A compact KPI tile: label + icon row, big value, tiny subtitle.
const kpiTones = {
  green: "bg-emerald-500/10 text-emerald-600",
  red: "bg-rose-500/10 text-rose-600",
  blue: "bg-sky-500/10 text-sky-600",
  amber: "bg-amber-500/10 text-amber-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
};

function Kpi({ icon: Icon, label, value, sub, tone = "indigo", valueClass, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-card p-3 shadow-card ${
        onClick ? "cursor-pointer transition hover:border-indigo-200 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpiTones[tone]}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className={`mt-1.5 truncate text-xl font-bold ${valueClass || "text-slate-800"}`}>
        {value}
      </div>
      <div className="mt-0.5 truncate text-xs text-slate-400">{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null); // /dashboard/stats object
  const [currency, setCurrency] = useState("LKR");
  const [topProfit, setTopProfit] = useState([]); // byProduct from /profit?days=30
  const [series, setSeries] = useState({}); // cache: key -> [{ label, value }]
  const [metric, setMetric] = useState("revenue"); // "revenue" | "profit"
  const [range, setRange] = useState("7"); // "7" | "30" | "12mo"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // What the chart shows right now.
  const seriesKey = metric === "profit" ? "profit-12mo" : `rev-${range}`;

  useEffect(() => {
    const load = async () => {
      try {
        // Stats, currency, the default 7-day revenue chart, and the
        // 30-day profit summary (which also carries top products by profit).
        const [s, cfg, d7, p30] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/settings"),
          api.get("/dashboard/daily-sales?days=7"),
          api.get("/dashboard/profit?days=30"),
        ]);
        setStats(s.data);
        setCurrency(cfg.data.currency || "LKR");
        setSeries({ "rev-7": d7.data });
        setTopProfit((p30.data.byProduct || []).slice(0, 5));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Fetch the chart series on demand (metric or range changed) and cache it.
  useEffect(() => {
    if (loading || series[seriesKey]) return;
    let cancelled = false;
    (async () => {
      try {
        let data;
        if (seriesKey === "profit-12mo") {
          const r = await api.get("/dashboard/profit?days=365");
          data = (r.data.byMonth || []).map((m) => ({
            label: m.label,
            value: m.profit,
          }));
        } else if (seriesKey === "rev-12mo") {
          data = (await api.get("/dashboard/monthly-sales")).data;
        } else {
          const days = seriesKey.slice(3);
          data = (await api.get(`/dashboard/daily-sales?days=${days}`)).data;
        }
        if (!cancelled) setSeries((s) => ({ ...s, [seriesKey]: data }));
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seriesKey, loading, series]);

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

  const chartData = series[seriesKey];
  const chartColor = metric === "profit" ? "#059669" : "#6366F1";
  const maxProfit = Math.max(...topProfit.map((p) => p.profit), 1);
  const avgOrder =
    stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
  const todayMargin = ((stats.todayProfit?.margin || 0) * 100).toFixed(1);

  const recentColumns = [
    {
      key: "invoice",
      header: "Invoice",
      render: (o) => <span className="font-medium text-slate-700">{o.invoiceNo}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => (o.customer ? o.customer.name : "Walk-in"),
    },
    {
      key: "cashier",
      header: "Cashier",
      render: (o) => (o.cashier ? o.cashier.name : "—"),
    },
    {
      key: "date",
      header: "Date",
      render: (o) => new Date(o.createdAt).toLocaleString(),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (o) => (
        <span className="font-medium text-slate-700">{money(o.total, currency)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      render: (o) => (
        <Badge tone={o.status === "completed" ? "success" : o.status === "cancelled" ? "neutral" : "danger"}>
          {o.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        <Kpi
          icon={Banknote}
          label="Today's Sales"
          value={money(stats.todayRevenue, currency)}
          sub={`${stats.todayOrders} order${stats.todayOrders === 1 ? "" : "s"} today`}
          tone="indigo"
        />
        <Kpi
          icon={TrendingUp}
          label="Today's Profit"
          value={money(stats.todayProfit?.profit, currency)}
          sub={`${todayMargin}% margin`}
          tone="green"
          valueClass={
            (stats.todayProfit?.profit || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
          }
        />
        <Kpi
          icon={Wallet}
          label="Total Revenue"
          value={money(stats.totalRevenue, currency)}
          sub="All completed sales"
          tone="blue"
        />
        <Kpi
          icon={Receipt}
          label="Avg Order Value"
          value={money(avgOrder, currency)}
          sub="Per completed sale"
          tone="indigo"
        />
        <Kpi
          icon={AlertTriangle}
          label="Low Stock"
          value={stats.lowStockCount}
          sub="At or below minimum"
          tone={stats.lowStockCount > 0 ? "red" : "amber"}
          onClick={() => navigate("/products")}
        />
      </div>

      {/* Chart + top products */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-card p-3 shadow-card lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {metric === "profit" ? "Profit · 12 months" : "Revenue"}
            </span>
            <div className="flex items-center gap-2">
              <Segmented
                options={[
                  { value: "revenue", label: "Revenue" },
                  { value: "profit", label: "Profit" },
                ]}
                value={metric}
                onChange={setMetric}
              />
              <Segmented
                options={[
                  { value: "7", label: "7d" },
                  { value: "30", label: "30d" },
                  { value: "12mo", label: "12mo" },
                ]}
                value={range}
                onChange={setRange}
                disabled={metric === "profit"}
              />
            </div>
          </div>
          <div className="h-40">
            {chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={false}
                    interval="equidistantPreserveStart"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={compact}
                  />
                  <Tooltip
                    formatter={(v) => money(v, currency)}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#chartFill)"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Loading…
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-card p-3 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Top Products
            </span>
            <span className="text-[10px] text-slate-400">by profit · 30d</span>
          </div>
          {topProfit.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No sales yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {topProfit.map((p, i) => (
                <li key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                      <span className="w-3 shrink-0 text-right text-slate-400">
                        {i + 1}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-emerald-600">
                      {money(p.profit, currency)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{
                        width: `${Math.max(0, (p.profit / maxProfit) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent sales */}
      <Table
        title="Recent Sales"
        columns={recentColumns}
        rows={stats.recent || []}
        emptyText="No sales yet. Complete a sale in the POS to see it here."
      />
    </div>
  );
}
