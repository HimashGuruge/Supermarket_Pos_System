// src/lib/printReceipt.js
// Shared receipt printer.
//
// Opens a small window sized for 58mm / 80mm thermal printers and
// prints the given sale. Both the POS page (right after a sale) and
// the Sales History page (old sales) use this same code, so the
// receipt always looks the same no matter where it is printed.
//
// printReceipt(sale, settings, money, apiBase)
//   sale      — full sale object from the API (items, totals, ...)
//   settings  — the settings document from GET /api/settings
//   money     — function that formats a number, e.g. (n) => "LKR 120.00"
//               (each page builds this from settings.currency)
//   apiBase   — the backend origin, so the logo image (stored on the
//               server at /uploads/...) can be loaded. Defaults to the
//               local dev server.

// Escape a string so it can be inserted into HTML safely.
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function printReceipt(sale, settings, money, apiBase = "http://localhost:3000") {
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) {
    // window.open returns null when pop-ups are blocked.
    return false;
  }

  // The store header lines. The logo is an image served by the
  // backend, so it needs the backend origin in front of its path.
  const storeLines = [
    settings.address ? `<p>${esc(settings.address)}</p>` : "",
    settings.phone ? `<p>${esc(settings.phone)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");
  const logoLine = settings.logo
    ? `<img src="${esc(apiBase + settings.logo)}" alt="" style="max-width:60mm;max-height:24mm;margin:2px auto 0;display:block" />`
    : "";

  const rows = sale.items
    .map(
      (it) =>
        `<tr>
           <td style="text-align:left">${it.name}</td>
           <td style="text-align:center">${it.quantity}</td>
           <td style="text-align:right">${money(it.lineTotal)}</td>
         </tr>`
    )
    .join("");
  const cashierName =
    sale.cashier && sale.cashier.name
      ? sale.cashier.name
      : "Cashier";

  w.document.write(`
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Receipt ${sale.invoiceNo}</title>
      <style>
        /* Sized for 58mm / 80mm thermal printers. */
        * { box-sizing: border-box; }
        body {
          font-family: "Courier New", monospace;
          width: 72mm; margin: 0; padding: 4mm;
          color: #000; font-size: 11px;
        }
        .head { text-align: center; }
        .head h1 { font-size: 14px; margin: 0; }
        .head p { margin: 1px 0; }
        .head img { max-width: 60mm; max-height: 24mm; margin: 2px auto 0; display: block; }
        hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 2px 0; font-size: 11px; }
        th { text-transform: uppercase; font-size: 10px; }
        .totals { margin-top: 6px; }
        .totals div { display: flex; justify-content: space-between; padding: 1px 0; }
        .grand { font-weight: bold; font-size: 13px; border-top: 1px solid #000; margin-top: 3px; padding-top: 3px; }
        .foot { text-align: center; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="head">
        ${logoLine}
        <h1>${esc(settings.storeName)}</h1>
        ${storeLines}
        <p>Receipt</p>
        <p>${esc(sale.invoiceNo)}</p>
        <p>${new Date(sale.createdAt).toLocaleString()}</p>
      </div>
      <hr />
      <table>
        <thead>
          <tr>
            <th style="text-align:left">Item</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
        <div><span>Discount</span><span>${money(sale.discount)}</span></div>
        <div><span>Tax (${sale.taxRate ?? settings.taxRate}%)</span><span>${money(sale.tax)}</span></div>
        <div class="grand"><span>TOTAL</span><span>${money(sale.total)}</span></div>
        <div><span>Paid (${sale.paymentMethod})</span><span>${money(sale.cashReceived || sale.total)}</span></div>
        ${
          sale.paymentMethod === "cash" && sale.balance > 0
            ? `<div><span>Change</span><span>${money(sale.balance)}</span></div>`
            : ""
        }
      </div>
      <hr />
      <div class="foot">
        <p>Cashier: ${esc(cashierName)}</p>
        <p>${esc(settings.receiptFooter)}</p>
      </div>
    </body>
    </html>
  `);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
