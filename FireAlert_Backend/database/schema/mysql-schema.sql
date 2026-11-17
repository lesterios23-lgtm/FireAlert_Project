/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `bfp_personnel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bfp_personnel` (
  `personnel_id` int NOT NULL AUTO_INCREMENT,
  `badge_number` varchar(50) NOT NULL,
  `rank_position` varchar(100) NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`personnel_id`),
  UNIQUE KEY `badge_number` (`badge_number`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `bfp_personnel_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fire_incident_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fire_incident_actions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `fire_incident_id` bigint unsigned DEFAULT NULL,
  `fire_report_id` bigint unsigned DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `action` varchar(40) NOT NULL,
  `reason` text,
  `meta` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fire_incident_actions_fire_incident_id_index` (`fire_incident_id`),
  KEY `fire_incident_actions_fire_report_id_index` (`fire_report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fire_incidents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fire_incidents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `incident_description` text COLLATE utf8mb4_unicode_ci,
  `incident_address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(11,7) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `first_reported_at` timestamp NULL DEFAULT NULL,
  `last_reported_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fire_incidents_code_unique` (`code`),
  KEY `fire_incidents_status_index` (`status`),
  KEY `fire_incidents_first_reported_at_index` (`first_reported_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `fire_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fire_reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `landmark_address` text,
  `fire_severity` varchar(50) NOT NULL,
  `additional_notes` text,
  `status_id` int NOT NULL,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fire_incident_id` bigint unsigned DEFAULT NULL,
  `duplicate_flag` varchar(20) DEFAULT NULL,
  `duplicate_of_report_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  KEY `user_id` (`user_id`),
  KEY `status_id` (`status_id`),
  KEY `fire_reports_fire_incident_id_index` (`fire_incident_id`),
  KEY `fire_reports_duplicate_flag_index` (`duplicate_flag`),
  CONSTRAINT `fire_reports_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fire_reports_ibfk_2` FOREIGN KEY (`status_id`) REFERENCES `response_statuses` (`status_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `firetrucks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `firetrucks` (
  `truck_id` int NOT NULL AUTO_INCREMENT,
  `plate_number` varchar(50) NOT NULL,
  `unit_name` varchar(100) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'Available',
  PRIMARY KEY (`truck_id`),
  UNIQUE KEY `plate_number` (`plate_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `incident_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incident_records` (
  `record_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `personnel_id` int NOT NULL,
  `damage_assessment` text,
  `casualties_count` int DEFAULT '0',
  `resolution_summary` text,
  `archived_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`record_id`),
  UNIQUE KEY `report_id` (`report_id`),
  KEY `personnel_id` (`personnel_id`),
  CONSTRAINT `incident_records_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `fire_reports` (`report_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `incident_records_ibfk_2` FOREIGN KEY (`personnel_id`) REFERENCES `bfp_personnel` (`personnel_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` smallint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `report_evidence`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_evidence` (
  `evidence_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `storage_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int unsigned NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`evidence_id`),
  KEY `report_evidence_report_id_index` (`report_id`),
  CONSTRAINT `report_evidence_report_id_foreign` FOREIGN KEY (`report_id`) REFERENCES `fire_reports` (`report_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `report_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `report_locations` (
  `location_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `barangay_name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`location_id`),
  UNIQUE KEY `report_id` (`report_id`),
  CONSTRAINT `report_locations_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `fire_reports` (`report_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `response_dispatches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `response_dispatches` (
  `dispatch_id` int NOT NULL AUTO_INCREMENT,
  `report_id` int NOT NULL,
  `truck_id` int NOT NULL,
  `personnel_id` int NOT NULL,
  `dispatched_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `arrived_at` timestamp NULL DEFAULT NULL,
  `estimated_eta_minutes` int DEFAULT NULL,
  `current_latitude` decimal(10,8) DEFAULT NULL,
  `current_longitude` decimal(11,8) DEFAULT NULL,
  `location_accuracy_meters` decimal(8,2) DEFAULT NULL,
  `location_updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`dispatch_id`),
  KEY `report_id` (`report_id`),
  KEY `truck_id` (`truck_id`),
  KEY `personnel_id` (`personnel_id`),
  CONSTRAINT `response_dispatches_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `fire_reports` (`report_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `response_dispatches_ibfk_2` FOREIGN KEY (`truck_id`) REFERENCES `firetrucks` (`truck_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `response_dispatches_ibfk_3` FOREIGN KEY (`personnel_id`) REFERENCES `bfp_personnel` (`personnel_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `response_statuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `response_statuses` (
  `status_id` int NOT NULL AUTO_INCREMENT,
  `status_name` varchar(50) NOT NULL,
  `description` text,
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `status_name` (`status_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` text,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `setting_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(255) NOT NULL,
  `contact_number` varchar(20) NOT NULL DEFAULT '',
  `address` varchar(500) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `profile_photo_path` varchar(255) DEFAULT NULL,
  `is_manager` tinyint(1) NOT NULL DEFAULT '0',
  `home_latitude` decimal(10,7) DEFAULT NULL,
  `home_longitude` decimal(11,7) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `users_google_id_unique` (`google_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (1,'2026_11_07_200000_make_firetruck_station_optional',1);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (2,'2026_11_07_210000_drop_bfp_stations_table',2);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (3,'2026_11_07_100000_add_address_to_users_table',3);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (4,'2026_11_09_100000_create_fire_incidents_table',3);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (5,'2026_11_09_110000_add_duplicate_flags_to_fire_reports_table',3);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (6,'2026_11_15_100000_add_live_location_to_response_dispatches_table',4);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (7,'2026_11_16_005555_add_profile_photo_path_to_users_table',5);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (8,'2026_11_16_093624_add_google_id_to_users_table',6);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (9,'0001_01_01_000001_create_cache_table',7);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (10,'0001_01_01_000002_create_jobs_table',8);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (11,'2026_10_28_145205_create_personal_access_tokens_table',9);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (12,'2026_11_17_000000_align_users_schema_and_system_settings',10);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (13,'0001_01_01_000000_create_users_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (14,'2026_10_30_134437_create_fire_reports_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (15,'2026_10_30_151434_add_role_to_users_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (16,'2026_10_31_083643_add_is_manager_to_users_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (17,'2026_11_07_000000_add_contact_number_to_users_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (18,'2026_11_07_130000_create_report_evidence_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (19,'2026_11_08_100000_add_home_coordinates_to_users_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (20,'2026_11_10_120000_create_system_settings_table',11);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (21,'2026_11_17_000001_create_sessions_and_password_reset_tokens_tables',12);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (22,'2026_11_17_000002_expand_columns_to_match_validation',13);
INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES (23,'2026_11_17_000003_default_contact_number_on_users',14);
