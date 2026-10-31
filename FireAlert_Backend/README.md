<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).

## FireAlert API

The versioned API uses JWT bearer tokens. Configure the database in `.env`, then set the application and JWT secrets:

```bash
php artisan key:generate
php artisan jwt:secret
php artisan migrate
```

Keep `.env` private and never commit either secret. Public registration always creates a `resident`; the submitted request cannot assign a privileged role. The new role column is nullable so existing accounts are not automatically assigned or downgraded. After verifying the existing authorized BFP account, assign its `bfp` role through a trusted administrative process before enabling role-based access.

Authentication endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` (bearer token required)
- `POST /api/v1/auth/refresh` (bearer token required)
- `POST /api/v1/auth/logout` (bearer token required)

Residents can create reports with `POST /api/v1/reports`. The JSON:API-style body must include `data.type` set to `fire_report` and `data.attributes.incidentDescription`. Provide either `incidentAddress` or both `latitude` and `longitude`; coordinates must be within valid geographic ranges, and coordinate submissions must include `locationSource` set to `device` or `manual`. The endpoint returns `201 Created` with the new report resource. The authenticated resident, initial `pending` status, and report timestamp are assigned by the server; clients cannot set ownership or workflow fields.

Example request using an address:

```json
{
  "data": {
    "type": "fire_report",
    "attributes": {
      "incidentDescription": "Smoke reported near the market.",
      "incidentAddress": "Mansalay Central Market"
    }
  }
}
```

Send authenticated requests with `Authorization: Bearer <access_token>`. Resident reports are available at `GET /api/v1/reports` and `GET /api/v1/reports/{id}`; both endpoints are scoped to the authenticated user. List responses use a versioned resource representation with `data`, pagination `links`, and `meta`, and return 15 reports per page (`?page=2`). To reduce list payload size, the incident description is omitted from list items and included in a report detail response.

Use `?include=resident` on either report endpoint to include the authenticated resident's name. Related data is omitted by default; resident email and other account details are not included.

The report list accepts allow-listed filters: `?status=pending,reviewed`, `?incidentAddress=*Mansalay*` (`*` matches any text), and `?reportedAt=2026-10-01,2026-10-31` (inclusive date range). You can combine filters; unknown query parameters are ignored. Filters never broaden the authenticated resident's report scope.

The nested `GET /api/v1/users/{user}/reports` endpoint uses the same filters and pagination but returns 404 unless `{user}` is the authenticated resident.

Report lists accept allow-listed sorting with `?sort=status` (ascending), `?sort=-reportedAt` (descending), or `?sort=status,-reportedAt` (multiple fields). Supported fields are `status`, `incidentAddress`, `reportedAt`, and `createdAt`; unsupported sort fields are ignored.

Residents can delete their reports with `DELETE /api/v1/reports/{id}` (bearer token required). The endpoint is idempotent, scoped to the authenticated resident, and returns `200 OK` with a confirmation message upon successful deletion, or `404 Not Found` if the report does not exist or belongs to another user.

Residents can replace an existing report with `PUT /api/v1/reports/{id}` (bearer token required). Unlike partial updates, PUT replaces the whole incident resource: the JSON:API body must include all required incident attributes (`incidentDescription` and valid location details via `incidentAddress` or coordinates). Missing required fields return `422 Unprocessable Entity`. Unsent optional fields (such as previously stored coordinates when switching to an address) are reset to null. The endpoint is scoped to the authenticated resident, preventing unauthorized modifications.

Residents can partially update an existing report with `PATCH /api/v1/reports/{id}` (bearer token required). The JSON:API body only needs to include the specific attributes being changed (for example, updating just the `incidentDescription` or location fields). Unsent attributes are left unmodified in the database. The endpoint is scoped to the authenticated resident and rejects modifications to unauthorized fields.

Resource modifications are protected by versioned model policies (`App\Policies\V1\FireReportPolicy`). If an authenticated resident attempts to modify a report they do not own, the policy rejects the request and returns `403 Forbidden` with the message `"You are not authorized to update that resource."`.

Token abilities are encoded directly into the JWT custom claims upon login (`App\Permissions\V1\Abilities`). Policies inspect token claims via `$user->tokenCan(...)`:
- **Regular residents** receive owner-scoped abilities (`report:own:create`, `report:own:update`, `report:own:delete`). They cannot replace reports via PUT and cannot update or delete other residents' reports (returning `403 Forbidden`).
- **Managers / BFP personnel** (`is_manager = true` or `role = 'bfp'`) receive broad operational abilities (`report:create`, `report:update`, `report:replace`, `report:delete`, `user:create`, etc.), enabling them to replace, update, or delete any emergency report.






### Granular Permissions (Topic 21)

Ability checks are applied inside the Form Requests themselves, before the controller, allowing fine-grained input rules per role:

- **On `POST /api/v1/reports`:** A resident holding `report:own:create` may optionally send their own id in `data.relationships.resident.data.id`, but sending any other user's id returns `422 Unprocessable Entity` (size rule). Managers holding `report:create` may supply any valid resident id to log a report on their behalf; the controller uses that id as the report owner. When the relationship field is omitted entirely, the authenticated user is always the owner.
- **On `PATCH /api/v1/reports/{id}`:** A resident holding `report:own:update` may not include `data.relationships.resident.data.id` at all — ownership is non-transferable and the field is `prohibited`, returning `422 Unprocessable Entity`. A manager holding `report:update` may include the field to reassign the report to another resident.
