# Build context: backend/.

FROM php:8.1-cli

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
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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
CMD ["sh", "-c", "php artisan config:clear && php artisan migrate --force && if [ \"$SEED_ON_BOOT\" = \"true\" ]; then php artisan db:seed --force; fi && exec php artisan serve --no-reload --host=0.0.0.0 --port=${PORT:-10000}"]
