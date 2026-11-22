<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class BarangayRiskReferenceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rows = [
            [
                'barangay_name' => 'Panaytayan',
                'latitude' => 12.5427,
                'longitude' => 121.3334,
                'reference_risk_level' => 'High',
                'risk_description' => 'Supplied initial reference: reported as having the highest number of grass fire incidents in 2025 and described as having rolling hills. Mansalay is generally vulnerable to grass fires during March–May due to prolonged dry conditions and grassland/rolling terrain.',
                'data_source' => 'Supplied barangay-level reference information (initial classification).',
                'verification_status' => 'Supplied initial reference',
            ],
            [
                'barangay_name' => 'Budburan',
                'latitude' => 12.4180,
                'longitude' => 121.4096,
                'reference_risk_level' => 'High',
                'risk_description' => 'Supplied initial reference: initially classified as High Risk. Mansalay is generally vulnerable to grass fires during March–May due to prolonged dry conditions and grassland/rolling terrain.',
                'data_source' => 'Supplied barangay-level reference information (initial classification).',
                'verification_status' => 'Supplied initial reference',
            ],
            [
                'barangay_name' => 'Don Pedro',
                'latitude' => 12.4894,
                'longitude' => 121.4241,
                'reference_risk_level' => 'Moderate',
                'risk_description' => 'Supplied initial reference: initially classified as Moderate Risk. Mansalay is generally vulnerable to grass fires during March–May due to prolonged dry conditions and grassland/rolling terrain.',
                'data_source' => 'Supplied barangay-level reference information (initial classification).',
                'verification_status' => 'Supplied initial reference',
            ],
            [
                'barangay_name' => 'Waygan',
                'latitude' => 12.5523,
                'longitude' => 121.4276,
                'reference_risk_level' => 'High',
                'risk_description' => 'Supplied initial reference: initially classified as High Risk. Mansalay is generally vulnerable to grass fires during March–May due to prolonged dry conditions and grassland/rolling terrain.',
                'data_source' => 'Supplied barangay-level reference information (initial classification).',
                'verification_status' => 'Supplied initial reference',
            ],
            [
                'barangay_name' => 'Santa Maria',
                'latitude' => 12.5672,
                'longitude' => 121.4677,
                'reference_risk_level' => 'Moderate',
                'risk_description' => 'Supplied initial reference: initially classified as Moderate Risk. Mansalay is generally vulnerable to grass fires during March–May due to prolonged dry conditions and grassland/rolling terrain.',
                'data_source' => 'Supplied barangay-level reference information (initial classification).',
                'verification_status' => 'Supplied initial reference',
            ],
            [
                'barangay_name' => 'Santa Teresita',
                'latitude' => 12.5187,
                'longitude' => 121.4244,
                'reference_risk_level' => 'Moderate',
                'risk_description' => 'Supplied initial reference: initially classified as Moderate Risk. Mansalay is generally vulnerable to grass fires during March–May due to prolonged dry conditions and grassland/rolling terrain.',
                'data_source' => 'Supplied barangay-level reference information (initial classification).',
                'verification_status' => 'Supplied initial reference',
            ],
        ];

        foreach ($rows as $row) {
            \App\Models\BarangayRiskReference::updateOrCreate(
                ['barangay_name' => $row['barangay_name']],
                array_merge($row, ['reference_last_updated_at' => now()])
            );
        }
    }
}
