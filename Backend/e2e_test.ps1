$ErrorActionPreference = "Stop"
$base = "http://localhost:3000/api"

function Get-Token($email, $pass) {
  $body = "{`"email`":`"$email`",`"password`":`"$pass`"}"
  $r = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $body -ContentType "application/json"
  return $r.token
}

$admin = Get-Token "admin@pos.com" "admin123"
Write-Host "ADMIN TOKEN OK: $($admin.Substring(0,12))..."
$headers = @{ Authorization = "Bearer $admin" }

# --- Get products to build a sale ---
$products = Invoke-RestMethod -Uri "$base/products" -Headers $headers
Write-Host "PRODUCTS: $($products.Count)"
$p1 = $products[0]
$p2 = $products[1]
Write-Host "p1=$($p1.name) stock=$($p1.stock) salePrice=$($p1.salePrice) purchasePrice=$($p1.purchasePrice)"
Write-Host "p2=$($p2.name) stock=$($p2.stock) salePrice=$($p2.salePrice) purchasePrice=$($p2.purchasePrice)"

# --- Create a sale (2 x p1, 1 x p2) ---
$saleBody = "{`"items`":[{`"product`":`"$($p1._id)`",`"quantity`":2},{`"product`":`"$($p2._id)`",`"quantity`":1}],`"discount`":0,`"paymentMethod`":`"cash`",`"cashReceived`":9999,`"customer`":null}"
$sale = Invoke-RestMethod -Uri "$base/sales" -Method Post -Headers $headers -Body $saleBody -ContentType "application/json"
Write-Host "SALE OK: $($sale.invoiceNo) total=$($sale.total) status=$($sale.status)"
Write-Host "  cost snapshot p1 line: costPerUnit=$($sale.items[0].costPerUnit)"
Write-Host "  stock after sale p1=$($p1.stock)"

# --- Test 1: return 1 unit of p1 (should succeed) ---
$retBody = "{`"sale`":`"$($sale._id)`",`"items`":[{`"product`":`"$($p1._id)`",`"quantity`":1}],`"reason`":`"e2e`"}"
$ret1 = Invoke-RestMethod -Uri "$base/returns" -Method Post -Headers $headers -Body $retBody -ContentType "application/json"
Write-Host "RETURN#1 OK: refundAmount=$($ret1.refundAmount)"

# --- Test 2: return the SAME line again (must 409 — only 1 of 2 left) ---
try {
  $ret2 = Invoke-RestMethod -Uri "$base/returns" -Method Post -Headers $headers -Body $retBody -ContentType "application/json"
  Write-Host "RETURN#2 UNEXPECTED SUCCESS: $($ret2.refundAmount)  <-- BUG"
} catch {
  $resp = $resp = $null
  $msg = $_.Exception.Message
  Write-Host "RETURN#2 REJECTED (expected 409): $msg"
}

# --- Test 3: return a line NOT in the sale (must 400) ---
$badBody = "{`"sale`":`"$($sale._id)`",`"items`":[{`"product`":`"$($p2._id)`",`"quantity`":5}],`"reason`":`"x`"}"
try {
  $bad = Invoke-RestMethod -Uri "$base/returns" -Method Post -Headers $headers -Body $badBody -ContentType "application/json"
  Write-Host "BAD-RETURN UNEXPECTED SUCCESS  <-- BUG"
} catch {
  Write-Host "BAD-RETURN REJECTED (expected 400): $($_.Exception.Message)"
}

# --- Test 4: purchase honors client costPerUnit ---
$suppliers = Invoke-RestMethod -Uri "$base/suppliers" -Headers $headers
Write-Host "SUPPLIERS: $($suppliers.Count)"
$sup = $suppliers[0]
$pcBody = "{`"supplier`":`"$($sup._id)`",`"items`":[{`"product`":`"$($p1._id)`",`"quantity`":10,`"costPerUnit`":7.5}],`"paidAmount`":100,`"notes`":`"e2e cost override`"}"
$pc = Invoke-RestMethod -Uri "$base/purchases" -Method Post -Headers $headers -Body $pcBody -ContentType "application/json"
Write-Host "PURCHASE OK: $($pc.invoiceNo) total=$($pc.total) (should use 7.5 => total 75)"
Write-Host "  stored costPerUnit=$($pc.items[0].costPerUnit)"

# --- Test 5: profit endpoint ---
$profit = Invoke-RestMethod -Uri "$base/dashboard/profit?days=30" -Headers $headers
Write-Host "PROFIT OK: revenue=$($profit.summary.revenue) cogs=$($profit.summary.cogs) profit=$($profit.summary.profit) refunded=$($profit.summary.refunded)"

# --- Test 6: dashboard stats (profit fields present) ---
$stats = Invoke-RestMethod -Uri "$base/dashboard/stats" -Headers $headers
Write-Host "STATS OK: todayRevenue=$($stats.todayRevenue) todayProfit.profit=$($stats.todayProfit.profit) totalProfit.profit=$($stats.totalProfit.profit)"

# --- Test 7: daily-sales buckets (timezone) ---
$daily = Invoke-RestMethod -Uri "$base/dashboard/daily-sales?days=7" -Headers $headers
Write-Host "DAILY OK: $($daily | ForEach-Object { $_.label + "=" + $_.value })"

Write-Host "=== E2E DONE ==="
