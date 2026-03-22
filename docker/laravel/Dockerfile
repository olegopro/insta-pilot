# php:8.3-fpm — многопроцессный FastCGI-сервер (не artisan serve)
# Nginx передаёт запросы через FastCGI-протокол на порт 9000
FROM php:8.3-fpm

# Системные зависимости + PHP-расширения:
# pdo_pgsql — PostgreSQL, pcntl — нужен для очереди Laravel, redis — кэш/очередь
RUN apt-get update && apt-get install -y \
    git curl unzip libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer берём из официального образа, не устанавливаем вручную
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# www.conf переопределяет дефолтный пул php-fpm: воркеры, таймауты, clear_env
COPY docker/laravel/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/laravel/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 9000 — внутренний порт PHP-FPM; наружу не пробрасывается, только для Nginx внутри Docker
EXPOSE 9000

ENTRYPOINT ["/entrypoint.sh"]
