-- ---------------------------------------------------------------------------
-- FireAlert reference data
--
-- Roles and report statuses are required for the application to work.
-- Import this file with phpMyAdmin when you cannot run the seeder:
--
--   php artisan db:seed --class=ReferenceDataSeeder --force
--
-- It is idempotent: running it twice updates the same rows.
-- ---------------------------------------------------------------------------

INSERT INTO `roles` (`role_id`, `role_name`, `description`) VALUES
  (1, 'Resident', 'General community user capable of submitting fire emergency reports'),
  (2, 'BFP Staff', 'Authorized fire station personnel managing dispatch and incidents'),
  (3, 'System Admin', 'System administrator managing user accounts and system configurations')
ON DUPLICATE KEY UPDATE
  `role_name` = VALUES(`role_name`),
  `description` = VALUES(`description`);

INSERT INTO `response_statuses` (`status_id`, `status_name`, `description`) VALUES
  (1, 'Submitted', 'Emergency report submitted by resident'),
  (2, 'Received', 'Emergency report acknowledged by BFP personnel'),
  (3, 'Dispatched', 'Firetruck and response team dispatched to incident location'),
  (4, 'En Route', 'Responders active on route to reported location'),
  (5, 'Arrived', 'Responders arrived on scene'),
  (6, 'Resolved', 'Emergency situation resolved and documented')
ON DUPLICATE KEY UPDATE
  `status_name` = VALUES(`status_name`),
  `description` = VALUES(`description`);
