$ErrorActionPreference = "Stop"
$base = "http://localhost:3000/api"

# wait for backend
for ($i=0; $i -lt 30; $i++) {
  try {
    Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body "{`"email`":`"admin@pos.com`",`"password`":`"admin123`"}" -ContentType "application/json" | Out-Null
    break
  } catch { Start-Sleep -Milliseconds 500 }
}

$r = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body "{`"email`":`"admin@pos.com`",`"password`":`"admin123`"}" -ContentType "application/json"
$headers = @{ Authorization = "Bearer $($r.token)" }

$sales = Invoke-RestMethod -Uri "$base/sales" -Headers $headers
$completed = $sales | Where-Object { $_.status -eq "completed" } | Select-Object -First 1
Write-Host "SALE: $($completed.invoiceNo) id=$($completed._id) items=$($completed.items.Count)"
$line = $completed.items[0]
Write-Host "line product=$($line.product) name=$($line.name) qty=$($line.quantity)"

$body = "{`"sale`":`"$($completed._id)`",`"items`":[{`"product`":`"$($line.product)`",`"quantity`":1}],`"reason`":`"stacktrace`"}"
try {
  $ret = Invoke-RestMethod -Uri "$base/returns" -Method Post -Headers $headers -Body $body -ContentType "application/json"
  Write-Host "RETURN OK refund=$($ret.refundAmount)"
} catch {
  Write-Host "RETURN FAIL: $($_.Exception.Message)"
}
