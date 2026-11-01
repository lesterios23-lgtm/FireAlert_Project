<?php

use App\Exceptions\ApiException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\RouteNotFoundException;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Illuminate\Validation\ValidationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            Route::middleware('api')
                ->prefix('api/v1')
                ->group(base_path('routes/api_v1.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Topic 25: one consistent JSON shape for every error on api routes.
        // { message, status } for plain errors, plus { errors } for validation.
        // Unexpected exceptions return a generic message; details go to the log
        // and never to the client.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null; // Non-API requests keep Laravel's default rendering.
            }

            $status = match (true) {
                $e instanceof ApiException => $e->statusCode,
                $e instanceof HttpExceptionInterface => $e->getStatusCode(),
                $e instanceof AuthenticationException => 401,
                $e instanceof AuthorizationException => 403,
                $e instanceof ModelNotFoundException,
                $e instanceof RouteNotFoundException => 404,
                $e instanceof ValidationException => $e->status,
                default => 500,
            };

            // Client-facing message. Only known exception types may pass their
            // own message through; anything else gets a generic one.
            $isMissingModel = $e instanceof ModelNotFoundException
                || $e instanceof RouteNotFoundException
                || ($e instanceof NotFoundHttpException && $e->getPrevious() instanceof ModelNotFoundException);

            $message = match (true) {
                $e instanceof ValidationException => 'Validation failed.',
                $e instanceof ApiException => $e->getMessage(),
                $e instanceof AuthenticationException => 'Unauthenticated.',
                $e instanceof AuthorizationException => $e->getMessage() ?: 'Forbidden.',
                $isMissingModel => 'Resource not found.',
                $e instanceof MethodNotAllowedHttpException => 'Method not allowed.',
                $e instanceof NotFoundHttpException => 'Route not found.',
                default => 'Server error.',
            };

            $body = [
                'message' => $message,
                'status' => $status,
            ];

            if ($e instanceof ValidationException) {
                $body['errors'] = $e->errors();
            }

            return response()->json($body, $status);
        });
    })->create();
