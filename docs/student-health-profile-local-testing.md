# Student Health Profile local tests (Windows)

Verified on `feature/student-module` with PHP 7.4.33, Composer 2.10.1,
PHPUnit 9.6.34, and MariaDB 11.5.2 on `127.0.0.1:3307`.

From the repository root in PowerShell:

```powershell
$env:Path = "C:\wamp64\bin\php\php7.4.33;" + $env:Path
$env:XDEBUG_MODE = 'off'
php -v
php --ini
Set-Location backend
composer check-platform-reqs
php vendor/bin/phpunit tests/Feature/StudentHealthProfileTest.php --testdox
Set-Location ../frontend
npm.cmd run build -- --configLoader native
```

The PATH change applies only to the current terminal. PHP loads
`C:\wamp64\bin\php\php7.4.33\php.ini`; Composer's launcher uses PHP from PATH.
Disabling Xdebug for this terminal avoids its inaccessible log-file warning.

Keep the existing WAMP MariaDB service running. PHPUnit explicitly selects
the existing `carelink_stability_testing` database at port 3307 and inherits
credentials from the local environment. The application uses port 3306 locally;
that is a separate MySQL 9.1.0 service. Do not change credentials or prepare,
reset, or migrate the database to run these tests. The Health Profile tests use
transactions, and their relevant tables were verified as InnoDB.

PHPUnit configuration forces `APP_URL=http://localhost` so malformed local
application URLs cannot cause test requests to return 404. The local `.env`
was left unchanged.

Run the explicit test file. Using only `--filter StudentHealthProfileTest`
loads other tests first, including `StudentDirectoryTest.php`, which uses PHP 8
named arguments. That Nurse directory test is outside this fix's scope.
PHP 8.2.26 fails the current dependency platform check because the locked
`lcobucci/jwt` requires PHP below 8.0. Upgrading PHP for the whole suite requires
a separately approved dependency upgrade; do not ignore platform requirements.

PHPUnit's damaged vendor file was restored from Composer's cached locked
9.6.34 archive using `composer reinstall phpunit/phpunit --prefer-dist
--no-scripts --no-interaction`. All 380 package files matched the archive.
The original trailing comma in a function call is valid on PHP 7.4; the edited
file was missing a closing brace. Do not manually patch vendor files or use
`composer update` to repair this.

Verification: Health Profile tests passed (4 tests, 70 assertions); all six
Student controllers, both Student/Health Profile models, Student middleware,
and the feature test passed PHP syntax checks. The frontend production build
passed with the native config loader (large-chunk warning remains). The default
config loader failed in the restricted execution environment with `spawn EPERM`.
