<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /** @var string */
    public const HOME = '/home';

    /** @var string|null */

    /** @return void */
    public function boot()
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::prefix('api')
                ->middleware('api')
                ->namespace($this->namespace)
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->namespace($this->namespace)
                ->group(base_path('routes/web.php'));
        });
    }

    /** @return void */
    protected function configureRateLimiting()
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by(optional($request->user())->id ?: $request->ip());
        });

        // Rolling 24-hour ceiling for the clinic assistant. The per-minute
        // throttle on the route stops bursts; this one stops a single student
        // from draining the shared Gemini daily quota.
        RateLimiter::for('chatbot-daily', function (Request $request) {
            return Limit::perDay((int) config('chatbot.daily_limit', 100))
                ->by(optional($request->user())->id ?: $request->ip());
        });
    }
}
