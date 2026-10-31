<?php

namespace App\Http\Filters\V1;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class QueryFilter
{
    protected Builder $builder;

    /**
     * Public sort names mapped to their database columns.
     *
     * @var array<string, string>
     */
    protected array $sortable = [];

    public function __construct(protected Request $request)
    {
    }

    public function apply(Builder $builder): Builder
    {
        $this->builder = $builder;

        foreach ($this->request->query() as $key => $value) {
            $method = lcfirst(str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $key))));

            if ($method !== 'apply' && ! str_starts_with($method, '__') && is_callable([$this, $method])) {
                $this->{$method}($value);
            }
        }

        return $this->builder;
    }

    protected function sort(mixed $value): void
    {
        if (! is_string($value)) {
            return;
        }

        foreach (explode(',', $value) as $attribute) {
            $attribute = trim($attribute);

            if ($attribute === '') {
                continue;
            }

            $direction = str_starts_with($attribute, '-') ? 'desc' : 'asc';
            $attribute = ltrim($attribute, '-');

            if (! array_key_exists($attribute, $this->sortable)) {
                continue;
            }

            $this->builder->orderBy($this->sortable[$attribute], $direction);
        }
    }
}
