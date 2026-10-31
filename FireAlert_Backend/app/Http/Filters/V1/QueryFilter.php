<?php

namespace App\Http\Filters\V1;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class QueryFilter
{
    protected Builder $builder;

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
}
