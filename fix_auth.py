import sys

p = r'C:\laragon\etc\apps\www\Individual_Pro\FireAlert_Backend\app\Http\Controllers\Api\V1\AdminDashboardController.php'
with open(p, 'r', encoding='utf-8') as f:
    s = f.read()
old = "$this->authorizeAdmin($request);"
new = "abort_unless($request->user() && $request->user()->role === 'admin', 403, 'Admin access required.');"
if old not in s:
    print('NOT FOUND')
else:
    s2 = s.replace(old, new)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s2)
    print('DONE', s.count(old))
