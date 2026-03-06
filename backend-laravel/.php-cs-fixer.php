<?php

$dirs = array_filter([
    __DIR__ . '/app',
    __DIR__ . '/tests',
    __DIR__ . '/database',
], 'is_dir');

$finder = PhpCsFixer\Finder::create()
    ->name('*.php')
    ->notName('*.blade.php');

foreach ($dirs as $dir) {
    $finder->in($dir);
}

if (empty($dirs)) {
    $finder->in('.');
}

return (new PhpCsFixer\Config())
    ->setUnsupportedPhpVersionAllowed(true)
    ->setRules([
        '@PSR12'                      => true,
        'array_indentation'           => true,
        'no_unused_imports'           => true,
        'single_line_empty_body'      => true,
        'method_chaining_indentation' => true,
        'curly_braces_position'       => [
            'classes_opening_brace'   => 'same_line',
            'functions_opening_brace' => 'same_line',
        ],
        'binary_operator_spaces' => [
            'operators' => [
                '=>' => 'align_single_space_minimal',
                '='  => 'align_single_space_minimal',
            ],
        ],
        'array_syntax' => ['syntax' => 'short'],
    ])
    ->setFinder($finder);
