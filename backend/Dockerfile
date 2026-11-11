# Build context: backend/.

# PHP 8.2: tapos na ang security support ng 8.1 (Dec 2025). Ang tag na "8.2-cli" ay laging
# kumukuha ng pinakabagong 8.2.x patch sa bawat build. Pansamantala ito: matatapos ang 8.2 sa
# Dec 31, 2026, at ang susunod na hakbang ay Laravel 12/13 + PHP 8.4 (hindi kaya ng Laravel 8).
FROM php:8.2-cli

RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libpq-dev \
    libssl-dev \
    libcurl4-openssl-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql mbstring exif pcntl bcmath gd zip curl \
    && docker-php-ext-install xml simplexml \
    && docker-php-ext-install opcache \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# OPcache: kung wala ito, kino-compile ulit ang Laravel sa bawat request (3-8s sa 0.1 CPU ng Render Free,
# lampas sa 5s health check kaya nire-restart ang instance). Hindi nagbabago ang code sa container.
RUN { \
    echo 'opcache.enable=1'; \
    echo 'opcache.enable_cli=1'; \
    echo 'opcache.validate_timestamps=0'; \
    echo 'opcache.memory_consumption=128'; \
    echo 'opcache.max_accelerated_files=20000'; \
    } > /usr/local/etc/php/conf.d/opcache-recommended.ini

# Student record files (hal. x-ray photo) hanggang 10MB; 2MB lang ang default ng PHP image.
RUN { \
    echo 'upload_max_filesize=12M'; \
    echo 'post_max_size=14M'; \
    } > /usr/local/etc/php/conf.d/uploads.ini

# Huwag ipakita ang PHP version sa "X-Powered-By" header (dagdag na proteksyon; ang tunay na
# ayos ay ang napapanahong PHP sa itaas).
RUN echo 'expose_php=Off' > /usr/local/etc/php/conf.d/security.ini

# Maraming worker para hindi maharangan ng mabagal na request (hal. SMTP) ang health check.
ENV PHP_CLI_SERVER_WORKERS=4

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Unahin ang Composer files para reusable ang dependency layer.
COPY composer.json composer.lock ./

# Wala pang .env sa build; skip muna ang Composer scripts.
# Legacy PHP constraints ang dahilan ng platform override.
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts --ignore-platform-req=php

COPY . .

RUN mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data \
    && mkdir -p storage/logs \
    && mkdir -p bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Discover packages without a local .env or build-time secrets.
RUN php artisan package:discover --ansi

RUN php artisan storage:link 2>/dev/null || true

# Render ang nagse-set ng PORT (default 10000).
EXPOSE 10000

# Migrate on boot: walang pre-deploy step ang Render free, at kailangang sabay ang code at schema.
# SEED_ON_BOOT=true: one-time seed (walang Shell sa Render free). Alisin pagkatapos.
# --no-reload preserves runtime environment variables in Laravel's server child.
# config:cache sa runtime (nandito na ang Render env vars); walang route:cache kasi may closure routes.
CMD ["sh", "-c", "php artisan config:cache && php artisan migrate --force && if [ \"$SEED_ON_BOOT\" = \"true\" ]; then php artisan db:seed --force; fi && exec php artisan serve --no-reload --host=0.0.0.0 --port=${PORT:-10000}"]
