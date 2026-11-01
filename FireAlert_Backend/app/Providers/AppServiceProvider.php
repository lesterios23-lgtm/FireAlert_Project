<?php

namespace App\Providers;

use App\Models\FireReport;
use App\Models\User;
use App\Policies\V1\FireReportPolicy;
use App\Policies\V1\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(FireReport::class, FireReportPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
    }
}
