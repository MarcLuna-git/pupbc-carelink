-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Sep 18, 2026 at 04:16 PM
-- Server version: 9.1.0
-- PHP Version: 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pupbc_carelink_v3`
--

-- --------------------------------------------------------

--
-- Table structure for table `ai_conversations`
--

DROP TABLE IF EXISTS `ai_conversations`;
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `assistant_reply` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gemini',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ai_conversations_user_id_index` (`user_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ai_conversations`
--

INSERT INTO `ai_conversations` (`id`, `user_id`, `user_message`, `assistant_reply`, `source`, `ip_address`, `created_at`, `updated_at`) VALUES
('3079aa54-fe71-4688-beb5-eb2fa3a8de61', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Masakit ang ulo ko, anong pwedeng gawin?', 'Naiintindihan kita! 💙 Narito ang mga pwede mong gawin:\n\n**🔍 Mga posibleng dahilan:**\nMaaaring sanhi ng kulang sa tulog, stress, dehydration, gutom, o sobrang paggamit ng computer/phone.\n\n**🏠 Home care:**\nMagpahinga, uminom ng maraming tubig, kumain ng tama, at iwasan muna ang screen. Maaaring uminom ng Paracetamol 500mg o Ibuprofen.\n\n**💊 Gamot (galing sa clinic):**\nParacetamol (500mg) o Ibuprofen\n\n**🚨 Kailan dapat pumunta sa clinic:**\nKung hindi pa rin gumagaling sa loob ng 2-3 araw, sobrang sakit, o may kasamang malabo ang paningin at pagsusuka - magpa-check na sa clinic.\n\nKung gusto mo, pwedeng kang **mag-book ng appointment** sa clinic para sa tamang check-up. 😊', 'fallback', '127.0.0.1', '2026-08-04 22:49:04', '2026-08-04 22:49:04'),
('5779dc2b-d594-4ded-8f43-9d1854c21353', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Ano ang capital ng France?', 'Pasensya na, hindi ko masyadong naintindihan ang tanong mo. 🤔\n\nPwede kang magtanong ng mga ganito:\n\n- \"Masakit ang ulo ko, ano ang pwede kong gawin?\"\n- \"Anong gamot para sa lagnat?\"\n- \"Paano mag-book ng appointment?\"\n- \"Saan ang clinic at anong oras bukas?\"\n\nKung may malubhang sintomas ka, pumunta ka agad sa clinic! 🏥', 'fallback', '127.0.0.1', '2026-08-04 22:49:18', '2026-08-04 22:49:18'),
('bcaeb779-fe42-4d41-a093-2cb8654e43d7', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Ano ang capital ng France?', 'Pasensya na, pero ako ang AI assistant ng PUP Binan Campus Health Clinic.\n\nNakakatulong lang ako sa mga tanong tungkol sa:\n\n🏥 **Clinic services** - anong mga sakit ang kayang gamutin, clinic hours, at location\n💊 **First aid / home care** - mga simpleng remedyo para sa karaniwang sakit\n🚨 **Kailan pupunta sa clinic** - kung kailan kailangan na ng tunay na check-up\n🌐 **Website usage** - paano mag-book ng appointment, gamitin ang QR code, at iba pa\n\nAnong masakit sa\'yo ngayon o anong kailangan mong malaman? 😊', 'guard', '127.0.0.1', '2026-08-04 22:49:55', '2026-08-04 22:49:55'),
('1f9c09de-a71d-45b5-b0e5-651079319a9d', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Hello', 'Hello! 👋 Ako si **CareBuddy**, ang AI assistant ng PUP Binan Campus Health Clinic.\n\nPwede kitang matulungan sa:\n\n- 🏥 **Anong mga sakit ang kayang gamutin ng clinic** (hal. lagnat, ubo, sakit ng ulo)\n- 💊 **Home care / first aid tips**\n- 🚨 **Kailan dapat pumunta sa clinic**\n- 🌐 **Paano gamitin ang CareLink website** (appointment, QR code, atbp.)\n\nAnong nararamdaman mo o ano ang gusto mong malaman? 😊', 'fallback', '127.0.0.1', '2026-08-04 22:49:56', '2026-08-04 22:49:56'),
('9d590ee5-6937-4879-8140-184ca2dd4fbe', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Masakit ang tiyan ko', 'Naiintindihan kita! 💙 Narito ang mga pwede mong gawin:\n\n**🔍 Mga posibleng dahilan:**\nMaaaring dulot ng hindi maayos na pagkain, kabag, hyperacidity, o gastritis.\n\n**🏠 Home care:**\nKumain ng magaan at regular, iwasan ang maaanghang at matataba na pagkain, at uminom ng antacid kung hyperacidity.\n\n**💊 Gamot (galing sa clinic):**\nAntacid (e.g. Kremil-S) o Paracetamol\n\n**🚨 Kailan dapat pumunta sa clinic:**\nKung matindi ang sakit, may dugo sa dumi o suka, tumagal ng 2+ araw, o may kasamang mataas na lagnat - magpa-check agad sa clinic.\n\nKung gusto mo, pwedeng kang **mag-book ng appointment** sa clinic para sa tamang check-up. 😊', 'fallback', '127.0.0.1', '2026-08-04 22:49:56', '2026-08-04 22:49:56'),
('942988e8-f59c-480c-be58-c1844448e85d', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Paano mag-book ng appointment?', 'Para mag-book ng appointment: pumunta sa \'Appointments\' sa sidebar, piliin ang date at available time slot, ilagay ang concern, at i-submit. Makakatanggap ka ng confirmation sa \'Notifications\'.\n\nSana nakatulong ito! 😊', 'fallback', '127.0.0.1', '2026-08-04 22:49:57', '2026-08-04 22:49:57'),
('f7965e81-c97c-4a5a-8edc-47d1f5c37100', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Anong oras bukas ang clinic?', '🏥 **PUP Binan Campus Health Clinic**\n\n🕐 **Oras:** Monday to Friday, 8:00 AM - 5:00 PM\n📍 **Lokasyon:** Ground Floor, Main Building, PUP Binan Campus\n📞 **Kontak:** Sa clinic mismo, o kaya i-book ang appointment through the website\n\n**Mga serbisyo:**\n- General consultation and checkup\n- Minor wound treatment and dressing\n- Medication dispensation (for common ailments)\n- Health monitoring (blood pressure, temperature)\n- First aid\n\n\nPwede kang mag-book ng appointment dito sa CareLink website. Kailangan mo lang pumunta sa **Appointments** sa sidebar! 😊', 'fallback', '127.0.0.1', '2026-08-04 22:49:58', '2026-08-04 22:49:58'),
('34de0bdd-5661-408a-b32a-8109de274850', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'nilalagnat ako', 'Naiintindihan kita! 💙 Narito ang mga pwede mong gawin:\n\n**🔍 Mga posibleng dahilan:**\nKadalasan dulot ng infection o viral illness. Karaniwan ang lagnat kapag may sipon, ubo, o iba pang sakit.\n\n**🏠 Home care:**\nMagpahinga, uminom ng maraming tubig, at magpalamig ng katawan. Pwedeng uminom ng Paracetamol tuwing 4-6 hours kung mataas ang lagnat.\n\n**💊 Gamot (galing sa clinic):**\nParacetamol (500mg)\n\n**🚨 Kailan dapat pumunta sa clinic:**\nPumunta agad sa clinic kung >38.5°C ang lagnat na hindi bumababa, tumagal ng 3+ araw, o may kasamang matinding panginginig, hirap huminga, o pagkahilo.\n\nKung gusto mo, pwedeng kang **mag-book ng appointment** sa clinic para sa tamang check-up. 😊', 'fallback', '127.0.0.1', '2026-08-04 22:53:30', '2026-08-04 22:53:30'),
('bdf73c73-3090-4cd2-b230-4b8d909b841e', '9db42e2e-4d2f-41e0-8472-56b931b41c6b', 'Anong gamot para sa lagnat?', 'Naiintindihan kita! 💙 Narito ang mga pwede mong gawin:\n\n**🔍 Mga posibleng dahilan:**\nKadalasan dulot ng infection o viral illness. Karaniwan ang lagnat kapag may sipon, ubo, o iba pang sakit.\n\n**🏠 Home care:**\nMagpahinga, uminom ng maraming tubig, at magpalamig ng katawan. Pwedeng uminom ng Paracetamol tuwing 4-6 hours kung mataas ang lagnat.\n\n**💊 Gamot (galing sa clinic):**\nParacetamol (500mg)\n\n**🚨 Kailan dapat pumunta sa clinic:**\nPumunta agad sa clinic kung >38.5°C ang lagnat na hindi bumababa, tumagal ng 3+ araw, o may kasamang matinding panginginig, hirap huminga, o pagkahilo.\n\nKung gusto mo, pwedeng kang **mag-book ng appointment** sa clinic para sa tamang check-up. 😊', 'fallback', '127.0.0.1', '2026-08-05 01:29:17', '2026-08-05 01:29:17');

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_audience` enum('all','students','nurses','admins') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'all',
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `announcements_created_by_foreign` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `service` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_date` date NOT NULL,
  `time_slot` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `concern` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reference_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `approved_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `queue_number` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `queue_type` enum('regular','priority') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'regular',
  `checked_in_at` timestamp NULL DEFAULT NULL,
  `no_show` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `appointments_reference_number_unique` (`reference_number`),
  KEY `appointments_approved_by_foreign` (`approved_by`),
  KEY `appointments_user_id_status_index` (`user_id`,`status`),
  KEY `appointments_appointment_date_status_index` (`appointment_date`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `appointments`
--

INSERT INTO `appointments` (`id`, `user_id`, `service`, `appointment_date`, `time_slot`, `concern`, `status`, `reference_number`, `approved_by`, `approved_at`, `rejection_reason`, `created_at`, `updated_at`, `deleted_at`, `queue_number`, `queue_type`, `checked_in_at`, `no_show`) VALUES
('76c951a1-49c3-482d-aabe-1eb854b3a353', 'f27e80b5-9998-4732-98f3-be692478bcc6', 'Consultation', '2026-09-20', '10:30 AM', NULL, 'pending', 'APT-GXSOO4NL', NULL, NULL, NULL, '2026-09-17 01:36:13', '2026-09-17 01:36:13', NULL, NULL, 'regular', NULL, 0),
('7a50253e-bfae-4b76-9b7f-467a7e60666c', '20876e37-dd5a-41dd-a301-105e006babe6', 'General Checkup', '2026-09-01', '9:00 AM - 10:00 AM', 'Regular checkup', 'pending', 'APT-S46JK8DJDH', NULL, NULL, NULL, '2026-08-31 10:28:38', '2026-08-31 10:28:38', NULL, NULL, 'regular', NULL, 0),
('e6d15dac-e0c9-4609-a70a-8906eb7a15b9', 'f27e80b5-9998-4732-98f3-be692478bcc6', 'Consultation', '2026-09-23', '8:30 AM', 'hindi ako makahinga', 'pending', 'APT-HLMUWDPP', NULL, NULL, NULL, '2026-09-17 01:35:22', '2026-09-17 01:35:22', NULL, NULL, 'regular', NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `appointment_checkins`
--

DROP TABLE IF EXISTS `appointment_checkins`;
CREATE TABLE IF NOT EXISTS `appointment_checkins` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue_number` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `queue_type` enum('regular','priority') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'regular',
  `triage_reason` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_walk_in` tinyint(1) NOT NULL DEFAULT '0',
  `status` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'waiting',
  `check_in_time` timestamp NULL DEFAULT NULL,
  `checked_in_at` timestamp NULL DEFAULT NULL,
  `chief_complaint` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `checkin_status` enum('confirmed','no_show') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `appointment_checkins_appointment_id_foreign` (`appointment_id`),
  KEY `appointment_checkins_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointment_slots`
--

DROP TABLE IF EXISTS `appointment_slots`;
CREATE TABLE IF NOT EXISTS `appointment_slots` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `time_slot` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `max_slots` int NOT NULL DEFAULT '10',
  `booked_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `appointment_slots_date_time_slot_unique` (`date`,`time_slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `consultations`
--

DROP TABLE IF EXISTS `consultations`;
CREATE TABLE IF NOT EXISTS `consultations` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `appointment_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nurse_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `chief_complaint` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `vital_signs` json DEFAULT NULL COMMENT '{bp, hr, rr, temp, o2_sat}',
  `general_remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `medical_certificate` tinyint(1) NOT NULL DEFAULT '0',
  `medical_certificate_ref` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `follow_up_required` tinyint(1) NOT NULL DEFAULT '0',
  `follow_up_date` date DEFAULT NULL,
  `status` enum('in_progress','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'in_progress',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `consultations_appointment_id_foreign` (`appointment_id`),
  KEY `consultations_user_id_created_at_index` (`user_id`,`created_at`),
  KEY `consultations_nurse_id_created_at_index` (`nurse_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_verifications`
--

DROP TABLE IF EXISTS `email_verifications`;
CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `email_verifications_user_id_is_used_index` (`user_id`,`is_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `health_profiles`
--

DROP TABLE IF EXISTS `health_profiles`;
CREATE TABLE IF NOT EXISTS `health_profiles` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `emergency_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_relationship` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `emergency_phone` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medical_history` json DEFAULT NULL,
  `allergy_details` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `other_medical_history` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medications` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `hospitalized` tinyint(1) NOT NULL DEFAULT '0',
  `hospitalization_date` date DEFAULT NULL,
  `hospitalization_diagnosis` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `surgery` tinyint(1) NOT NULL DEFAULT '0',
  `surgery_date` date DEFAULT NULL,
  `surgery_diagnosis` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `had_covid` tinyint(1) NOT NULL DEFAULT '0',
  `covid_date` date DEFAULT NULL,
  `covid_diagnosis` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `occupation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marital_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tobacco_use` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tobacco_amount` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tobacco_duration` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alcohol_use` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `other_substance_use` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `has_disability` tinyint(1) NOT NULL DEFAULT '0',
  `disability_details` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `last_menstrual_period` date DEFAULT NULL,
  `has_children` tinyint(1) NOT NULL DEFAULT '0',
  `number_of_children` int DEFAULT NULL,
  `age_first_pregnancy` int DEFAULT NULL,
  `gravidity` tinyint(1) NOT NULL DEFAULT '0',
  `term` tinyint(1) NOT NULL DEFAULT '0',
  `premature` tinyint(1) NOT NULL DEFAULT '0',
  `abortion` tinyint(1) NOT NULL DEFAULT '0',
  `living_children` tinyint(1) NOT NULL DEFAULT '0',
  `family_history` json DEFAULT NULL,
  `consent_signature` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agree_privacy` tinyint(1) NOT NULL DEFAULT '0',
  `agree_terms` tinyint(1) NOT NULL DEFAULT '0',
  `consent_date` date DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `health_profiles_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `health_profiles`
--

INSERT INTO `health_profiles` (`id`, `user_id`, `emergency_name`, `emergency_relationship`, `emergency_phone`, `medical_history`, `allergy_details`, `other_medical_history`, `medications`, `hospitalized`, `hospitalization_date`, `hospitalization_diagnosis`, `surgery`, `surgery_date`, `surgery_diagnosis`, `had_covid`, `covid_date`, `covid_diagnosis`, `occupation`, `marital_status`, `tobacco_use`, `tobacco_amount`, `tobacco_duration`, `alcohol_use`, `other_substance_use`, `has_disability`, `disability_details`, `last_menstrual_period`, `has_children`, `number_of_children`, `age_first_pregnancy`, `gravidity`, `term`, `premature`, `abortion`, `living_children`, `family_history`, `consent_signature`, `agree_privacy`, `agree_terms`, `consent_date`, `completed_at`, `created_at`, `updated_at`) VALUES
('b64a8a41-3cd4-4c60-a5f6-dc15fb110183', '20876e37-dd5a-41dd-a301-105e006babe6', NULL, NULL, NULL, NULL, 'None', NULL, NULL, 0, NULL, NULL, 0, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, 0, NULL, NULL, 0, 0, 0, 0, 0, NULL, NULL, 1, 1, NULL, '2026-08-31 11:04:10', '2026-08-31 10:28:38', '2026-08-31 11:04:10'),
('c3d52afe-7ed2-4f74-80aa-db7ca0078c89', 'f27e80b5-9998-4732-98f3-be692478bcc6', 'Alyssa MM M. Cataylo', 'Spouse', '09949228450', '\"[\\\"Bronchial Asthma\\\"]\"', 'dust', 'none', 'cetirizine', 0, NULL, NULL, 0, NULL, NULL, 0, NULL, NULL, 'none', 'Married', 'Never', NULL, NULL, 'Occasional', 'none', 0, NULL, NULL, 0, NULL, NULL, 0, 0, 0, 0, 0, '\"[\\\"Asthma\\\"]\"', 'Marc Laurence Luna', 1, 1, '2026-09-16', '2026-09-17 01:29:50', '2026-09-17 01:29:50', '2026-09-17 02:09:30');

-- --------------------------------------------------------

--
-- Table structure for table `medicines`
--

DROP TABLE IF EXISTS `medicines`;
CREATE TABLE IF NOT EXISTS `medicines` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `generic_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `minimum_stock` int NOT NULL DEFAULT '10',
  `unit` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tablet',
  `dosage` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `added_by` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `medicines_added_by_foreign` (`added_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
CREATE TABLE IF NOT EXISTS `migrations` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '2019_12_14_000001_create_personal_access_tokens_table', 1),
(2, '2024_01_01_000000_create_users_table', 1),
(3, '2026_07_04_180904_create_student_profiles_table', 1),
(4, '2026_07_04_180948_create_health_profiles_table', 1),
(5, '2026_07_04_181046_create_appointments_table', 1),
(6, '2026_07_04_181119_create_consultations_table', 1),
(7, '2026_07_05_104955_create_appointment_checkins_table', 1),
(8, '2026_07_05_105927_create_notifications_table', 1),
(9, '2026_07_05_110006_create_audit_logs_table', 1),
(10, '2026_07_05_110023_create_qr_codes_table', 1),
(11, '2026_07_05_110041_create_otp_codes_table', 1),
(12, '2026_07_05_110058_create_announcements_table', 1),
(13, '2026_07_07_001137_create_email_verifications_table', 1),
(14, '2026_07_09_071005_create_medicines_table', 1),
(15, '2026_07_09_132041_update_appointments_for_kiosk', 1),
(16, '2026_07_10_062727_create_appointment_slots_table', 1),
(17, '2026_08_20_000000_fix_appointment_checkins_kiosk_schema', 1),
(18, '2026_09_06_000001_add_kiosk_columns_to_appointment_checkins', 2),
(19, '2026_09_16_000001_create_pending_registrations_table', 2),
(20, '2026_09_16_000002_complete_kiosk_schema_for_postgres', 2);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_read_index` (`user_id`,`read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('email_verification','password_reset') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `otp_codes_user_id_type_is_used_index` (`user_id`,`type`,`is_used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pending_registrations`
--

DROP TABLE IF EXISTS `pending_registrations`;
CREATE TABLE IF NOT EXISTS `pending_registrations` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `otp_hash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pending_registrations_email_unique` (`email`),
  UNIQUE KEY `pending_registrations_student_id_unique` (`student_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint UNSIGNED NOT NULL,
  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `qr_codes`
--

DROP TABLE IF EXISTS `qr_codes`;
CREATE TABLE IF NOT EXISTS `qr_codes` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_code_hash` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_code_path` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_scanned_at` timestamp NULL DEFAULT NULL,
  `scan_count` int NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_codes_qr_code_hash_unique` (`qr_code_hash`),
  KEY `qr_codes_user_id_foreign` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `qr_codes`
--

INSERT INTO `qr_codes` (`id`, `user_id`, `qr_code_hash`, `qr_code_path`, `last_scanned_at`, `scan_count`, `is_active`, `expires_at`, `created_at`, `updated_at`) VALUES
('df6ebc1c-7e73-4f31-bb4e-0e2141d2689b', 'f27e80b5-9998-4732-98f3-be692478bcc6', 'e527a4a350260c198ac6bec1f8b621932536d71c134af0d2bafa65b463c49a49', NULL, NULL, 0, 1, NULL, '2026-09-17 01:27:32', '2026-09-17 01:27:32'),
('e9b6c87e-2bba-4633-aac7-3a602a33cc37', '20876e37-dd5a-41dd-a301-105e006babe6', '0c97966d-d200-4c71-8159-90b28aaab93b', NULL, NULL, 0, 1, NULL, '2026-08-31 10:28:38', '2026-08-31 11:04:10');

-- --------------------------------------------------------

--
-- Table structure for table `student_profiles`
--

DROP TABLE IF EXISTS `student_profiles`;
CREATE TABLE IF NOT EXISTS `student_profiles` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `course` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `gender` enum('male','female','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `profile_picture` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guardian_name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guardian_relationship` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guardian_contact` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `student_profiles_user_id_foreign` (`user_id`),
  KEY `student_profiles_course_index` (`course`),
  KEY `student_profiles_year_index` (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `student_profiles`
--

INSERT INTO `student_profiles` (`id`, `user_id`, `course`, `year`, `section`, `birthday`, `gender`, `mobile_number`, `address`, `profile_picture`, `guardian_name`, `guardian_relationship`, `guardian_contact`, `created_at`, `updated_at`) VALUES
('2362581a-5f65-4aaa-adc6-324480120573', 'f27e80b5-9998-4732-98f3-be692478bcc6', 'BSIT', '4th Year', '4-1', '2004-09-24', 'male', '09931024169', NULL, NULL, NULL, NULL, NULL, '2026-09-17 01:27:32', '2026-09-17 01:27:32'),
('918154eb-1284-4e1f-b838-1c39cc009c54', '20876e37-dd5a-41dd-a301-105e006babe6', 'BSIT', '3', 'A', '2002-05-15', 'male', '09123456789', NULL, NULL, NULL, NULL, NULL, '2026-08-31 10:28:38', '2026-08-31 10:28:38');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `student_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `middle_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `birthday` date DEFAULT NULL,
  `gender` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `course` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `section` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('student','nurse','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `status` enum('pending','active','inactive','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `last_login_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remember_token` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_student_id_unique` (`student_id`),
  KEY `users_email_status_index` (`email`,`status`),
  KEY `users_student_id_status_index` (`student_id`,`status`),
  KEY `users_role_status_index` (`role`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `student_id`, `first_name`, `middle_name`, `last_name`, `birthday`, `gender`, `course`, `year`, `section`, `mobile_number`, `email`, `email_verified_at`, `password`, `role`, `status`, `last_login_at`, `ip_address`, `remember_token`, `created_at`, `updated_at`, `deleted_at`) VALUES
('20876e37-dd5a-41dd-a301-105e006babe6', '2021-00001-BN-0', 'Juan', NULL, 'Dela Cruz', '2002-05-15', NULL, NULL, NULL, NULL, NULL, 'juan@example.com', '2026-08-31 11:04:10', 'student', 'student', 'active', '2026-08-31 13:10:03', '127.0.0.1', NULL, '2026-08-31 10:28:38', '2026-08-31 13:10:03', NULL),
('e1edfbea-75e3-4880-b6bf-2bbdf7c2f0b2', NULL, 'Jane', NULL, 'Doe', NULL, NULL, NULL, NULL, NULL, NULL, 'nurse@pupbc.edu.ph', '2026-08-31 11:04:10', 'nurse', 'nurse', 'active', NULL, NULL, NULL, '2026-08-31 10:28:38', '2026-08-31 11:04:10', NULL),
('f27e80b5-9998-4732-98f3-be692478bcc6', '2023-00057-BN-0', 'Marc Laurence', 'Arevalo', 'Luna', '2004-09-24', 'male', 'BSIT', '4th Year', '4-1', '09931024169', 'marclaurenceluna15@gmail.com', '2026-09-17 01:27:32', '$2y$10$uun8NvLTydYjBBqvHt4KDeM/S/bKOU5KHtgAik/XL0J1oVtY09h1e', 'student', 'pending', NULL, NULL, NULL, '2026-09-17 01:27:32', '2026-09-17 01:27:32', NULL);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `announcements`
--
ALTER TABLE `announcements`
  ADD CONSTRAINT `announcements_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `appointments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `appointment_checkins`
--
ALTER TABLE `appointment_checkins`
  ADD CONSTRAINT `appointment_checkins_appointment_id_foreign` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `appointment_checkins_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `consultations`
--
ALTER TABLE `consultations`
  ADD CONSTRAINT `consultations_appointment_id_foreign` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `consultations_nurse_id_foreign` FOREIGN KEY (`nurse_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `consultations_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD CONSTRAINT `email_verifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `health_profiles`
--
ALTER TABLE `health_profiles`
  ADD CONSTRAINT `health_profiles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `medicines`
--
ALTER TABLE `medicines`
  ADD CONSTRAINT `medicines_added_by_foreign` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `otp_codes`
--
ALTER TABLE `otp_codes`
  ADD CONSTRAINT `otp_codes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `qr_codes`
--
ALTER TABLE `qr_codes`
  ADD CONSTRAINT `qr_codes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_profiles`
--
ALTER TABLE `student_profiles`
  ADD CONSTRAINT `student_profiles_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
