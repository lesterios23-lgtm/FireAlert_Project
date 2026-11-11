<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class LoginAttemptSettings
{
    public const DEFAULT_MAX_ATTEMPTS = 5;

    public const DEFAULT_LOCKOUT_MINUTES = 15;

    private const MAX_ATTEMPTS_KEY = 'login_max_attempts';

    private const LOCKOUT_MINUTES_KEY = 'login_lockout_minutes';

    /** @return array{max_attempts: int, lockout_minutes: int} */
    public function get(): array
    {
        $settings = Cache::rememberForever('login_attempt_settings', function (): array {
            if (! DB::getSchemaBuilder()->hasTable('system_settings')) {
                return [];
            }

            return DB::table('system_settings')
                ->whereIn('setting_key', [self::MAX_ATTEMPTS_KEY, self::LOCKOUT_MINUTES_KEY])
                ->pluck('setting_value', 'setting_key')
                ->all();
        });

        return [
            'max_attempts' => max(1, (int) ($settings[self::MAX_ATTEMPTS_KEY] ?? self::DEFAULT_MAX_ATTEMPTS)),
            'lockout_minutes' => max(1, (int) ($settings[self::LOCKOUT_MINUTES_KEY] ?? self::DEFAULT_LOCKOUT_MINUTES)),
        ];
    }

    /** @param array{max_attempts: int, lockout_minutes: int} $settings */
    public function update(array $settings): array
    {
        foreach ([
            self::MAX_ATTEMPTS_KEY => $settings['max_attempts'],
            self::LOCKOUT_MINUTES_KEY => $settings['lockout_minutes'],
        ] as $key => $value) {
            DB::table('system_settings')->updateOrInsert(
                ['setting_key' => $key],
                ['setting_value' => (string) $value, 'updated_at' => now(), 'created_at' => now()],
            );
        }

        Cache::forget('login_attempt_settings');

        return $this->get();
    }
}
