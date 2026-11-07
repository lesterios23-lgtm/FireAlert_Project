$login = Invoke-RestMethod -Uri http://localhost:8000/api/v1/auth/login -Method Post -Body (@{ email='bfp@test.com'; password='password123' } | ConvertTo-Json) -ContentType 'application/json'
$tok = $login.data.access_token
$body = '{"data":{"type":"fire_report","attributes":{"status":"responding"}}}'
$r = Invoke-WebRequest -Uri 'http://localhost:8000/api/v1/reports/1' -Method Patch -Headers @{ Authorization = "Bearer $tok" } -ContentType 'application/json' -Body $body -SkipHttpErrorCheck
"$($r.StatusCode): $($r.Content.Substring(0, [Math]::Min(250, $r.Content.Length)))"
