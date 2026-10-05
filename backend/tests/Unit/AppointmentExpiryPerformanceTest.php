<?php

namespace Tests\Unit;

use App\Http\Middleware\ExpireStaleAppointments;
use App\Services\AppointmentExpiry;
use Illuminate\Container\Container;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Mockery;
use PHPUnit\Framework\TestCase;

class AppointmentExpiryPerformanceTest extends TestCase
{
    /** @dataProvider publicPaths */
    public function test_public_and_auth_requests_do_not_run_clinic_maintenance(string $path): void
    {
        $previousContainer = Container::getInstance();
        $previousFacadeApplication = Facade::getFacadeApplication();
        $container = new Container();
        $cache = Mockery::mock();
        $cache->shouldNotReceive('add');
        $expiry = Mockery::mock(AppointmentExpiry::class);
        $expiry->shouldNotReceive('run');
        $container->instance('cache', $cache);
        $container->instance(AppointmentExpiry::class, $expiry);
        Container::setInstance($container);
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($container);
        try {
            $request = Request::create($path);
            $result = (new ExpireStaleAppointments())->handle($request, function ($received) use ($request) {
                $this->assertSame($request, $received);
                return 'response';
            });
            $this->assertSame('response', $result);
            Mockery::close();
        } finally {
            Container::setInstance($previousContainer);
            Facade::clearResolvedInstances();
            Facade::setFacadeApplication($previousFacadeApplication);
        }
    }

    public static function publicPaths(): array
    {
        return [['/api/health'], ['/api/auth/login'], ['/api/auth/admin-login'], ['/api/announcements'], ['/api/announcements/example']];
    }
}
