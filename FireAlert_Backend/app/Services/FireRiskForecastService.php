<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Fetches live current + 7-day weather forecasts from Open-Meteo and combines
 * them with baseline barangay terrain vulnerability and historical fire records
 * to predict daily High / Moderate / Low fire risk per Mansalay location.
 */
class FireRiskForecastService
{
    private const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

    private const CACHE_TTL_MINUTES = 20;

    private const FORECAST_DAYS = 7;

    /**
     * @param  list<array<string, mixed>>  $locations
     * @return array<string, mixed>
     */
    public function buildForecast(array $locations, int $selectedDayIndex = 0, bool $forceRefresh = false): array
    {
        $selectedDayIndex = max(0, min(self::FORECAST_DAYS - 1, $selectedDayIndex));
        $fetchedAt = now('Asia/Manila')->toIso8601String();

        $weatherFeeds = $this->fetchWeatherFeeds($locations, $forceRefresh);
        $weatherAvailable = $weatherFeeds !== null;

        // Collect all forecast dates (fallback to local Asia/Manila dates if weather feed is offline)
        $dates = [];
        for ($d = 0; $d < self::FORECAST_DAYS; $d++) {
            $fallbackDate = now('Asia/Manila')->addDays($d)->toDateString();
            $dates[$d] = $weatherFeeds[0]['daily']['time'][$d] ?? $fallbackDate;
        }

        $dayBuckets = [];
        for ($d = 0; $d < self::FORECAST_DAYS; $d++) {
            $dayBuckets[$d] = [
                'day_index' => $d,
                'date' => $dates[$d],
                'label' => $this->dayLabel($d, $dates[$d]),
                'high_risk_count' => 0,
                'moderate_risk_count' => 0,
                'low_risk_count' => 0,
                'temp_sum' => 0.0,
                'temp_count' => 0,
                'precip_sum' => 0.0,
                'precip_count' => 0,
            ];
        }

        $selectedPredictions = [];

        foreach ($locations as $idx => $location) {
            $feed = $weatherAvailable ? ($weatherFeeds[$idx] ?? null) : null;

            for ($d = 0; $d < self::FORECAST_DAYS; $d++) {
                $scored = $this->scoreLocationForDay($location, $feed, $d, $dates[$d]);
                $level = $scored['predicted_risk_level'];

                if ($level === 'High') {
                    $dayBuckets[$d]['high_risk_count']++;
                } elseif ($level === 'Moderate') {
                    $dayBuckets[$d]['moderate_risk_count']++;
                } else {
                    $dayBuckets[$d]['low_risk_count']++;
                }

                if ($scored['weather'] !== null) {
                    if ($scored['weather']['temp_max_c'] !== null) {
                        $dayBuckets[$d]['temp_sum'] += $scored['weather']['temp_max_c'];
                        $dayBuckets[$d]['temp_count']++;
                    }
                    if ($scored['weather']['precipitation_mm'] !== null) {
                        $dayBuckets[$d]['precip_sum'] += $scored['weather']['precipitation_mm'];
                        $dayBuckets[$d]['precip_count']++;
                    }
                }

                if ($d === $selectedDayIndex) {
                    $selectedPredictions[] = $scored;
                }
            }
        }

        usort($selectedPredictions, function (array $a, array $b): int {
            $scoreCmp = ($b['predicted_risk_score'] ?? 0) <=> ($a['predicted_risk_score'] ?? 0);
            if ($scoreCmp !== 0) {
                return $scoreCmp;
            }

            return strcmp((string) ($a['barangay_name'] ?? ''), (string) ($b['barangay_name'] ?? ''));
        });

        $highRiskLocations = array_values(array_filter(
            $selectedPredictions,
            fn (array $item): bool => ($item['predicted_risk_level'] ?? '') === 'High',
        ));

        $forecastDays = array_map(function (array $bucket): array {
            return [
                'day_index' => $bucket['day_index'],
                'date' => $bucket['date'],
                'label' => $bucket['label'],
                'high_risk_count' => $bucket['high_risk_count'],
                'moderate_risk_count' => $bucket['moderate_risk_count'],
                'low_risk_count' => $bucket['low_risk_count'],
                'avg_temp_max' => $bucket['temp_count'] > 0
                    ? round($bucket['temp_sum'] / $bucket['temp_count'], 1)
                    : null,
                'avg_precip_mm' => $bucket['precip_count'] > 0
                    ? round($bucket['precip_sum'] / $bucket['precip_count'], 1)
                    : null,
            ];
        }, $dayBuckets);

        return [
            'weather_available' => $weatherAvailable,
            'weather_source' => 'Open-Meteo live forecast (Asia/Manila)',
            'weather_fetched_at' => $fetchedAt,
            'selected_day_index' => $selectedDayIndex,
            'selected_date' => $dates[$selectedDayIndex] ?? now('Asia/Manila')->toDateString(),
            'forecast_days' => $forecastDays,
            'daily_predictions' => $selectedPredictions,
            'high_risk_locations' => $highRiskLocations,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $locations
     * @return list<array<string, mixed>>|null
     */
    private function fetchWeatherFeeds(array $locations, bool $forceRefresh): ?array
    {
        $coords = [];
        foreach ($locations as $location) {
            if (! is_numeric($location['latitude'] ?? null) || ! is_numeric($location['longitude'] ?? null)) {
                return null;
            }
            $coords[] = [
                round((float) $location['latitude'], 4),
                round((float) $location['longitude'], 4),
            ];
        }

        if ($coords === []) {
            return [];
        }

        $latList = implode(',', array_column($coords, 0));
        $lngList = implode(',', array_column($coords, 1));
        $cacheKey = 'fire_risk_open_meteo_'.md5($latList.'|'.$lngList);

        if ($forceRefresh) {
            Cache::forget($cacheKey);
        } else {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && count($cached) === count($coords)) {
                return $cached;
            }
        }

        try {
            $response = Http::timeout(8)->acceptJson()->get(self::FORECAST_URL, [
                'latitude' => $latList,
                'longitude' => $lngList,
                'timezone' => 'Asia/Manila',
                'forecast_days' => self::FORECAST_DAYS,
                'current' => 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code',
                'daily' => 'temperature_2m_max,relative_humidity_2m_min,wind_speed_10m_max,precipitation_sum,precipitation_probability_max,weather_code',
            ]);

            if (! $response->ok()) {
                return null;
            }

            $payload = $response->json();
            if (! is_array($payload)) {
                return null;
            }

            // Open-Meteo returns an associative object for 1 coordinate, or a
            // list of objects when multiple coordinates are requested.
            $feeds = array_is_list($payload) ? $payload : [$payload];
            if (count($feeds) !== count($coords)) {
                return null;
            }

            Cache::put($cacheKey, $feeds, now()->addMinutes(self::CACHE_TTL_MINUTES));

            return $feeds;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $location
     * @param  array<string, mixed>|null  $feed
     * @return array<string, mixed>
     */
    private function scoreLocationForDay(array $location, ?array $feed, int $dayIndex, string $date): array
    {
        $baselineLevel = (string) ($location['reference_risk_level'] ?? 'Low');
        $baselinePoints = match (strtolower($baselineLevel)) {
            'high' => 20,
            'moderate' => 12,
            default => 6,
        };

        $historical = is_array($location['historical'] ?? null) ? $location['historical'] : ['available' => false];
        $historicalScore = (float) ($historical['risk_score'] ?? 0);
        $historicalPoints = min(20, (int) round($historicalScore * 0.25));

        $reasons = [];
        $weatherSummary = null;
        $weatherPoints = 0;
        $seasonBonus = 0;

        $daily = is_array($feed['daily'] ?? null) ? $feed['daily'] : null;
        $current = $dayIndex === 0 && is_array($feed['current'] ?? null) ? $feed['current'] : null;

        if ($daily !== null) {
            $tempMax = $this->numericAt($daily['temperature_2m_max'] ?? [], $dayIndex);
            $humidityMin = $this->numericAt($daily['relative_humidity_2m_min'] ?? [], $dayIndex);
            $windMax = $this->numericAt($daily['wind_speed_10m_max'] ?? [], $dayIndex);
            $precipSum = $this->numericAt($daily['precipitation_sum'] ?? [], $dayIndex);
            $precipProb = $this->numericAt($daily['precipitation_probability_max'] ?? [], $dayIndex);
            $weatherCode = $this->numericAt($daily['weather_code'] ?? [], $dayIndex);

            $currentTemp = $current !== null && is_numeric($current['temperature_2m'] ?? null)
                ? (float) $current['temperature_2m']
                : null;
            $currentHumidity = $current !== null && is_numeric($current['relative_humidity_2m'] ?? null)
                ? (float) $current['relative_humidity_2m']
                : null;
            $currentWind = $current !== null && is_numeric($current['wind_speed_10m'] ?? null)
                ? (float) $current['wind_speed_10m']
                : null;
            $currentPrecip = $current !== null && is_numeric($current['precipitation'] ?? null)
                ? (float) $current['precipitation']
                : null;
            $currentCode = $current !== null && is_numeric($current['weather_code'] ?? null)
                ? (int) $current['weather_code']
                : null;

            if ($dayIndex === 0) {
                if ($currentTemp !== null && ($tempMax === null || $currentTemp > $tempMax)) {
                    $tempMax = $currentTemp;
                }
                if ($currentHumidity !== null && ($humidityMin === null || $currentHumidity < $humidityMin)) {
                    $humidityMin = $currentHumidity;
                }
                if ($currentWind !== null && ($windMax === null || $currentWind > $windMax)) {
                    $windMax = $currentWind;
                }
            }

            if ($tempMax !== null) {
                $weatherPoints += match (true) {
                    $tempMax >= 35.0 => 22,
                    $tempMax >= 33.0 => 17,
                    $tempMax >= 31.0 => 12,
                    $tempMax >= 29.0 => 7,
                    default => 3,
                };
                if ($tempMax >= 33.0) {
                    $reasons[] = sprintf('Hot conditions (%.1f°C max)', $tempMax);
                }
            }

            if ($humidityMin !== null) {
                $weatherPoints += match (true) {
                    $humidityMin <= 45.0 => 22,
                    $humidityMin <= 55.0 => 16,
                    $humidityMin <= 65.0 => 10,
                    $humidityMin <= 75.0 => 5,
                    default => 1,
                };
                if ($humidityMin <= 55.0) {
                    $reasons[] = sprintf('Dry air (%.0f%% min humidity)', $humidityMin);
                } elseif ($humidityMin >= 80.0) {
                    $reasons[] = sprintf('Humid air (%.0f%% min humidity)', $humidityMin);
                }
            }

            if ($windMax !== null) {
                $weatherPoints += match (true) {
                    $windMax >= 25.0 => 12,
                    $windMax >= 18.0 => 9,
                    $windMax >= 12.0 => 6,
                    $windMax >= 6.0 => 3,
                    default => 1,
                };
                if ($windMax >= 18.0) {
                    $reasons[] = sprintf('Strong wind (%.0f km/h)', $windMax);
                }
            }

            $effectivePrecip = $precipSum ?? 0.0;
            $rainPoints = match (true) {
                $effectivePrecip <= 0.1 => 8,
                $effectivePrecip <= 2.0 => 1,
                $effectivePrecip <= 8.0 => -12,
                default => -25,
            };

            if ($dayIndex === 0 && $currentPrecip !== null && $currentPrecip > 0.5) {
                $currentRainSuppression = $currentPrecip > 3.0 ? -25 : -12;
                $rainPoints = min($rainPoints, $currentRainSuppression);
            }
            $weatherPoints += $rainPoints;

            if ($effectivePrecip <= 0.2 && ($currentPrecip === null || $currentPrecip <= 0.2)) {
                $reasons[] = sprintf('Dry day (%.1f mm rain)', $effectivePrecip);
            } elseif ($effectivePrecip > 8.0 || ($currentPrecip !== null && $currentPrecip > 3.0)) {
                $reasons[] = sprintf('Heavy rainfall suppresses fire risk (%.1f mm)', max($effectivePrecip, $currentPrecip ?? 0.0));
            } elseif ($effectivePrecip > 2.0) {
                $reasons[] = sprintf('Rainfall lowers risk (%.1f mm)', $effectivePrecip);
            }

            try {
                $month = Carbon::parse($date)->month;
                if ($month >= 3 && $month <= 5 && $effectivePrecip <= 1.0) {
                    $seasonBonus = 5;
                    $reasons[] = 'Dry-season grassfire factor (Mar–May)';
                }
            } catch (\Throwable) {
                // ignore invalid date
            }

            $weatherSummary = [
                'date' => $date,
                'temp_max_c' => $tempMax !== null ? round($tempMax, 1) : null,
                'current_temp_c' => $currentTemp !== null ? round($currentTemp, 1) : null,
                'humidity_min_pct' => $humidityMin !== null ? (int) round($humidityMin) : null,
                'current_humidity_pct' => $currentHumidity !== null ? (int) round($currentHumidity) : null,
                'wind_max_kmh' => $windMax !== null ? round($windMax, 1) : null,
                'precipitation_mm' => round($effectivePrecip, 1),
                'precipitation_probability_pct' => $precipProb !== null ? (int) round($precipProb) : null,
                'weather_code' => $currentCode ?? ($weatherCode !== null ? (int) $weatherCode : null),
                'condition_label' => $this->weatherCodeLabel($currentCode ?? ($weatherCode !== null ? (int) $weatherCode : null)),
            ];
        } else {
            $reasons[] = 'Live weather feed temporarily unavailable; showing baseline & historical score only.';
        }

        if ($baselineLevel === 'High') {
            $reasons[] = 'Grassland / rolling terrain baseline (High)';
        }
        if (! empty($historical['available']) && ($historical['incident_count'] ?? 0) > 0) {
            $count = (int) $historical['incident_count'];
            $reasons[] = "{$count} historical incident".($count === 1 ? '' : 's').' recorded';
        }

        $totalScore = max(0, min(100, $weatherPoints + $baselinePoints + $historicalPoints + $seasonBonus));
        $predictedLevel = match (true) {
            $totalScore >= 60 => 'High',
            $totalScore >= 38 => 'Moderate',
            default => 'Low',
        };

        return [
            ...$location,
            'predicted_risk_score' => $totalScore,
            'predicted_risk_level' => $predictedLevel,
            'weather' => $weatherSummary,
            'reasons' => $reasons,
            'score_breakdown' => [
                'weather' => $weatherPoints,
                'baseline' => $baselinePoints,
                'historical' => $historicalPoints,
                'season_bonus' => $seasonBonus,
            ],
        ];
    }

    /**
     * @param  array<int|string, mixed>  $values
     */
    private function numericAt(array $values, int $index): ?float
    {
        if (! array_key_exists($index, $values) || ! is_numeric($values[$index])) {
            return null;
        }

        return (float) $values[$index];
    }

    private function dayLabel(int $dayIndex, string $date): string
    {
        if ($dayIndex === 0) {
            return 'Today';
        }
        if ($dayIndex === 1) {
            return 'Tomorrow';
        }

        try {
            return Carbon::parse($date)->format('D, M j');
        } catch (\Throwable) {
            return $date;
        }
    }

    private function weatherCodeLabel(?int $code): string
    {
        if ($code === null) {
            return 'Unavailable';
        }

        return match (true) {
            $code === 0 => 'Clear sky',
            in_array($code, [1, 2], true) => 'Partly cloudy',
            $code === 3 => 'Overcast',
            in_array($code, [45, 48], true) => 'Foggy',
            in_array($code, [51, 53, 55, 56, 57], true) => 'Drizzle',
            in_array($code, [61, 63, 80, 81], true) => 'Rain',
            in_array($code, [65, 66, 67, 82], true) => 'Heavy rain',
            in_array($code, [95, 96, 99], true) => 'Thunderstorm',
            default => 'Variable weather',
        };
    }
}
