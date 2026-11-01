<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

/**
 * An API error with a safe, client-facing message and an HTTP status code.
 * Thrown anywhere in the API code; the JSON renderer in bootstrap/app.php
 * turns it into the project's standard error envelope.
 */
class ApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $statusCode = 400,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
