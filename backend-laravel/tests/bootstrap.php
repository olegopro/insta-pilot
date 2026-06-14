<?php

declare(strict_types=1);

/*
 * ЗАЩИТА ОТ ПОТЕРИ ДАННЫХ.
 *
 * Тесты ОБЯЗАНЫ работать на изолированной in-memory sqlite, а не на dev/prod-БД.
 * В Docker переменные DB_* приходят как OS-окружение ($_SERVER/$_ENV/getenv) из
 * docker-compose и ПЕРЕБИВАЮТ <env> из phpunit.xml (Laravel читает $_SERVER раньше),
 * поэтому RefreshDatabase мог сделать migrate:fresh по боевой postgres.
 *
 * Форсим тестовую БД во ВСЕХ представлениях окружения ДО загрузки Laravel.
 */
foreach ([
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE'   => ':memory:',
    'DB_HOST'       => '127.0.0.1',
] as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

require __DIR__ . '/../vendor/autoload.php';
