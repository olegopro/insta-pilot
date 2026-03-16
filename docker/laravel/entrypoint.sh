#!/bin/sh
set -e

# Install Laravel if not yet installed
if [ ! -f artisan ]; then
    echo "Installing Laravel..."
    composer create-project laravel/laravel . --prefer-dist --no-interaction
fi

# Install dependencies if vendor is missing
if [ ! -d vendor ]; then
    composer install --no-interaction
fi

if [ "$#" -eq 0 ]; then
    exec php artisan serve --host=0.0.0.0 --port=8000
else
    exec "$@"
fi
