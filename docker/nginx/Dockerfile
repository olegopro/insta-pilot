# Nginx выступает фронтенд-сервером: принимает все запросы на :8000,
# кэширует медиа-прокси (fastcgi_cache) и передаёт PHP через FastCGI laravel:9000
FROM nginx:1.27-alpine

# Папка для fastcgi_cache — bind-mount на хост (docker/nginx/cache) в docker-compose
RUN mkdir -p /var/cache/nginx/media /var/cache/nginx/cdn

# Единственный vhost: настройки кэша, proxy-location и PHP-location
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8000
