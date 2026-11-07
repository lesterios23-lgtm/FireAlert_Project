<?php
use App\Models\User;
$users = User::limit(15)->get(['id', 'email', 'role', 'is_manager']);
echo 'count=' . $users->count() . PHP_EOL;
foreach ($users as $x) {
    echo $x->id . ' | ' . $x->email . ' | role=' . $x->role . ' | mgr=' . var_export($x->is_manager, true) . PHP_EOL;
}
