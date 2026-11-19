// src/lib/printReceipt.js
// Shared receipt printer.
//
// Opens a small window sized for 58mm / 80mm thermal printers and
// prints the given sale. Both the POS page (right after a sale) and
// the Sales History page (old sales) use this same code, so the
// receipt always looks the same no matter where it is printed.
//
// printReceipt(sale, settings, money)
//   sale      — full sale object from the API (items, totals, ...)
//   settings  — the settings document from GET /api/settings
//   money     — function that formats a number, e.g. (n) => "LKR 120.00"
//               (each page builds this from settings.currency)

export function printReceipt(sale, settings, money) {
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) {
    // window.open returns null when pop-ups are blocked.
    return false;
  }

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
        <h1>${settings.storeName}</h1>
        <p>Receipt</p>
        <p>${sale.invoiceNo}</p>
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
        <p>Cashier: ${cashierName}</p>
        <p>${settings.receiptFooter}</p>
      </div>
    </body>
    </html>
  `);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
