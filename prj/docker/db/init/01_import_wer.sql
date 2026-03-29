USE `pet_mornitoring`;

-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: pet_monitoring
-- ------------------------------------------------------
-- Server version	9.1.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alerts_log`
--

DROP TABLE IF EXISTS `alerts_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alerts_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cat_name` varchar(191) NOT NULL,
  `color` varchar(50) DEFAULT NULL,
  `alert_type` varchar(50) NOT NULL,
  `message` varchar(500) NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `alert_date` date GENERATED ALWAYS AS (cast(`created_at` as date)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_daily` (`cat_name`,`alert_type`,`message`(191),`alert_date`),
  KEY `idx_alerts_log_cat` (`cat_name`),
  KEY `idx_alerts_log_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alerts_log`
--

LOCK TABLES `alerts_log` WRITE;
/*!40000 ALTER TABLE `alerts_log` DISABLE KEYS */;
INSERT INTO `alerts_log` (`id`, `cat_name`, `color`, `alert_type`, `message`, `is_read`, `created_at`) VALUES (1,'มอมแมม','Red','no_eating','cat1 กินอาหารน้อยกว่า 2 ครั้ง/วัน',0,'2026-01-10 23:59:00'),(2,'มอมแมม','Red','low_excrete','cat1 ขับถ่ายน้อยกว่าที่กำหนด (0/3)',0,'2026-01-10 23:59:00'),(3,'cat2','Pink','no_eating','cat2 กินอาหารน้อยกว่า 2 ครั้ง/วัน',0,'2026-01-10 23:59:00'),(4,'cat2','Pink','low_excrete','cat2 ขับถ่ายน้อยกว่าที่กำหนด (0/3)',0,'2026-01-10 23:59:00'),(5,'ทองดี','Orange','no_eating','Orange กินอาหารน้อยกว่า 7 ครั้ง/วัน',1,'2026-01-10 23:59:00'),(6,'มอมแมม','Red','no_cat','ไม่พบ cat1 เกิน 12 ชั่วโมง',0,'2026-01-11 23:59:00'),(7,'cat2','Pink','no_cat','ไม่พบ cat2 เกิน 12 ชั่วโมง',0,'2026-01-11 23:59:00'),(8,'ทองดี','Orange','no_cat','ไม่พบ Orange เกิน 12 ชั่วโมง',1,'2026-01-11 23:59:00'),(9,'ทองดี','Orange','no_eating','ทองดี กินอาหารน้อยกว่า 7 ครั้ง/วัน',1,'2026-01-11 23:59:00'),(10,'ทองดี','Orange','low_excrete','ทองดี ขับถ่ายน้อยกว่าที่กำหนด (0/3)',1,'2026-01-11 23:59:00'),(11,'ทองดี','Orange','no_cat','ไม่พบ ทองดี เกิน 12 ชั่วโมง',1,'2026-01-12 23:59:00'),(12,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-01-12 23:59:00'),(13,'ทองดี','Orange','no_eating','ทองดี กินอาหารน้อยกว่า 2 ครั้ง/วัน',1,'2025-12-17 23:59:00'),(14,'ทองดี','Orange','low_excrete','ทองดี ขับถ่ายน้อยกว่าที่กำหนด (1/3)',1,'2025-12-17 23:59:00'),(15,'มอมแมม','Red','no_eating','มอมแมม กินอาหารน้อยกว่า 2 ครั้ง/วัน',0,'2025-12-17 23:59:00'),(16,'มอมแมม','Red','low_excrete','มอมแมม ขับถ่ายน้อยกว่าที่กำหนด (0/3)',0,'2025-12-17 23:59:00'),(17,'ทองดี','Orange','no_cat','ไม่พบ ทองดี เกิน 12 ชั่วโมง',1,'2026-01-13 23:59:00'),(18,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-01-13 23:59:00'),(19,'ทองดี','Orange','no_cat','ไม่พบ ทองดี เกิน 12 ชั่วโมง',1,'2026-01-14 23:59:00'),(20,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-01-14 23:59:00'),(21,'ทองดี','Orange','no_cat','ไม่พบ ทองดี เกิน 12 ชั่วโมง',1,'2026-01-20 23:59:00'),(22,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-01-20 23:59:00'),(23,'ทองดี','Orange','no_cat','ไม่พบ ทองดี เกิน 12 ชั่วโมง',0,'2026-02-03 23:59:00'),(24,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-02-03 23:59:00'),(25,'ทองดี','Orange','no_eating','ทองดี กินอาหารน้อยกว่า 2 ครั้ง/วัน',0,'2026-02-03 23:59:00'),(26,'ทองดี','Orange','low_excrete','ทองดี ขับถ่ายน้อยกว่าที่กำหนด (0/3)',0,'2026-02-03 23:59:00'),(27,'มอมแมม','Red','no_eating','มอมแมม กินอาหารน้อยกว่า 2 ครั้ง/วัน',0,'2026-02-03 23:59:00'),(28,'มอมแมม','Red','low_excrete','มอมแมม ขับถ่ายน้อยกว่าที่กำหนด (0/3)',0,'2026-02-03 23:59:00'),(30,'ทองดี','Orange','no_cat','ไม่พบ ทองดี เกิน 12 ชั่วโมง',0,'2026-02-04 23:59:00'),(31,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-02-04 23:59:00'),(54,'ทองดี','pink','no_cat','ไม่พบ ทองดี เกิน 1 ชั่วโมง',0,'2026-02-10 23:59:00'),(55,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-02-10 23:59:00'),(56,'ทองดี','pink','no_cat','ไม่พบ ทองดี เกิน 1 ชั่วโมง',0,'2026-02-11 23:59:00'),(57,'มอมแมม','Red','no_cat','ไม่พบ มอมแมม เกิน 12 ชั่วโมง',0,'2026-02-11 23:59:00'),(58,'ทองดี','pink','no_eating','ทองดี กินอาหารน้อยกว่า 1 ครั้ง/วัน',0,'2026-02-11 23:59:00'),(59,'ทองดี','pink','low_excrete','ทองดี ขับถ่ายน้อยกว่าที่กำหนด (0/2)',0,'2026-02-11 23:59:00'),(60,'มอมแมม','Red','no_eating','มอมแมม กินอาหารน้อยกว่า 2 ครั้ง/วัน',0,'2026-02-11 23:59:00'),(61,'มอมแมม','Red','low_excrete','มอมแมม ขับถ่ายน้อยกว่าที่กำหนด (0/3)',0,'2026-02-11 23:59:00');
/*!40000 ALTER TABLE `alerts_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cat_config_monthly`
--

DROP TABLE IF EXISTS `cat_config_monthly`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cat_config_monthly` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `month_ym` char(7) NOT NULL,
  `cat_color` varchar(50) NOT NULL,
  `cat_name` varchar(100) DEFAULT NULL,
  `alert_no_eat` int NOT NULL,
  `alert_no_excrete_max` int NOT NULL,
  `avg_eat_per_day` decimal(10,2) DEFAULT NULL,
  `avg_excrete_per_day` decimal(10,2) DEFAULT NULL,
  `days_in_month` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cat_month` (`cat_color`,`month_ym`),
  KEY `idx_month` (`month_ym`),
  KEY `idx_color` (`cat_color`)
) ENGINE=InnoDB AUTO_INCREMENT=221 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cat_config_monthly`
--

LOCK TABLES `cat_config_monthly` WRITE;
/*!40000 ALTER TABLE `cat_config_monthly` DISABLE KEYS */;
INSERT INTO `cat_config_monthly` VALUES (4,'2025-09','Orange','ทองดี',7,6,NULL,NULL,NULL,'2026-01-06 21:54:34'),(8,'2025-09','Black','มอมแมม',3,5,NULL,NULL,NULL,'2026-01-06 21:54:34'),(9,'2025-10','Black','มอมแมม',3,5,NULL,NULL,NULL,'2026-01-06 21:54:34'),(10,'2025-11','Black','มอมแมม',3,5,NULL,NULL,NULL,'2026-01-06 21:54:34'),(11,'2025-12','Black','มอมแมม',3,5,NULL,NULL,NULL,'2026-01-06 21:54:34'),(12,'2025-10','White','cat7',2,4,NULL,NULL,NULL,'2026-01-06 21:54:34'),(13,'2025-11','White','cat7',2,4,NULL,NULL,NULL,'2026-01-06 21:54:34'),(14,'2025-12','White','cat7',2,4,NULL,NULL,NULL,'2026-01-06 21:54:34'),(15,'2025-12','Red','cat1',0,0,0.00,0.00,31,'2026-01-20 20:54:11'),(16,'2025-12','Pink','cat2',0,0,0.00,0.00,31,'2026-01-09 23:48:29'),(17,'2025-12','Yellow','cat4',0,0,0.00,0.00,31,'2026-01-09 23:48:29'),(18,'2025-12','Green','cat5',0,0,0.00,0.00,31,'2026-01-09 23:48:30'),(55,'2025-10','Orange','ทองดี',2,6,2.00,6.00,31,'2026-01-12 16:16:49'),(56,'2025-10','Red','มอมแมมมห',0,0,0.00,0.00,31,'2026-01-12 16:16:50'),(57,'2025-11','Orange','ทองดี',2,6,2.00,6.00,30,'2026-01-12 16:16:51'),(58,'2025-11','Red','มอมแมมมห',0,0,0.00,0.00,30,'2026-01-12 16:16:51'),(59,'2025-12','Orange','ทองดี',2,6,1.94,5.84,31,'2026-01-20 20:54:11');
/*!40000 ALTER TABLE `cat_config_monthly` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cats`
--

DROP TABLE IF EXISTS `cats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cats` (
  `name` varchar(100) NOT NULL,
  `image_url` text,
  `real_image_url` varchar(255) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `display_status` int DEFAULT '0',
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cats`
--

LOCK TABLES `cats` WRITE;
/*!40000 ALTER TABLE `cats` DISABLE KEYS */;
INSERT INTO `cats` VALUES ('cat1','/assets/Blackcat.png',NULL,'Black',0),('cat2','/assets/Pinkcat.png',NULL,'Pink',0),('cat3','/assets/Azurecat.png',NULL,'Azure',0),('cat4','/assets/Yellowcat.png',NULL,'Yellow',0),('cat5','/assets/Greencat.png',NULL,'Green',0),('cat6','/assets/Purplecat.png',NULL,'Purple',0),('cat7','/assets/Whitecat.png',NULL,'White',0),('cat8','/assets/Bluecat.png',NULL,'Blue',0),('ทองดี','/assets/OrangeCat.png','/assets/uploads/ทองดี_806bc5ba2bab4a7e87366dae8063d503.jpg','pink',1),('มอมแมม','/assets/Redcat.png','/assets/uploads/มอมแมม_1f9c781dc68645999aa1d5612b7f89b8.jpeg','Red',1);
/*!40000 ALTER TABLE `cats` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `line_link_codes`
--

DROP TABLE IF EXISTS `line_link_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `line_link_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `code` varchar(16) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_code` (`code`),
  KEY `idx_user` (`user_id`),
  KEY `idx_exp` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `line_link_codes`
--

LOCK TABLES `line_link_codes` WRITE;
/*!40000 ALTER TABLE `line_link_codes` DISABLE KEYS */;
INSERT INTO `line_link_codes` VALUES (66,1,'LQKG3GDP','2026-02-10 14:59:15','2026-02-10 14:49:15');
/*!40000 ALTER TABLE `line_link_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `line_links`
--

DROP TABLE IF EXISTS `line_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `line_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `line_user_id` varchar(64) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user` (`user_id`),
  UNIQUE KEY `uniq_line_user` (`line_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `line_links`
--

LOCK TABLES `line_links` WRITE;
/*!40000 ALTER TABLE `line_links` DISABLE KEYS */;
INSERT INTO `line_links` VALUES (3,1,'U4bce5d33fc26c073a1499c5b4d120578','2026-02-10 14:06:18');
/*!40000 ALTER TABLE `line_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_state`
--

DROP TABLE IF EXISTS `notification_state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_state` (
  `k` varchar(64) NOT NULL,
  `v` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`k`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_state`
--

LOCK TABLES `notification_state` WRITE;
/*!40000 ALTER TABLE `notification_state` DISABLE KEYS */;
INSERT INTO `notification_state` VALUES ('last_alert_push_id','61','2026-02-11 00:44:11');
/*!40000 ALTER TABLE `notification_state` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_subscriptions`
--

DROP TABLE IF EXISTS `push_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `endpoint` text NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_endpoint` (`endpoint`(255)),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_subscriptions`
--

LOCK TABLES `push_subscriptions` WRITE;
/*!40000 ALTER TABLE `push_subscriptions` DISABLE KEYS */;
INSERT INTO `push_subscriptions` VALUES (5,'https://fcm.googleapis.com/fcm/send/fEko7rEk8p4:APA91bF1pJziD_aTI3dViy49-x0iWIX-rHtIkiCiZC7zKJxMoDhGEpY5mbOyYoYVXH4hie_kKYcEXgH7jmmJCbvqj2ODL5fn_1NYNjnQpitoiLhTrgd0tnywUVjm064BprSTOujewkk2','BHryB0P-C_7OE7AaEanzD1kvnPFrA2enIbRDOqbEGcfBNOIPCw4KrXw4mi_jmnVXJYg0JIDJ5mFbEG5FhZoxaio','2DdCnIrX8gfovDKSRwEa5g','2026-01-20 10:59:31',1),(10,'https://fcm.googleapis.com/fcm/send/dSTmM95zR1o:APA91bFFi9uPyxKQMAlRr_PhZUb2nictdvz9cIPB3K6rk8HDpMXdE1dyl1f9QC4QLoWW_JGDmuUypcgDi5vLntKaGFP2UZuaei1H_6bAkk24pImjkP16NE0NlSsv8Vv1_AsFFGUwO7sY','BGyqjGZ1m_AgbIBkffuPsNmCA3FcWY8H4u60Q4qg-GXRdsPHyZrI-TJASFPvFleqwML8j3LmTp36yovJ0c6YqUs','msB93g_qESFBZwusIook2Q','2026-02-10 13:25:42',1);
/*!40000 ALTER TABLE `push_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rooms`
--

DROP TABLE IF EXISTS `rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rooms` (
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rooms`
--

LOCK TABLES `rooms` WRITE;
/*!40000 ALTER TABLE `rooms` DISABLE KEYS */;
INSERT INTO `rooms` VALUES ('Hall'),('Room2'),('Room1'),('Kitchen');
/*!40000 ALTER TABLE `rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_config`
--

DROP TABLE IF EXISTS `system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `alert_no_cat` int NOT NULL,
  `alert_no_excrete_min` int NOT NULL,
  `alert_no_excrete_max` int NOT NULL,
  `alert_no_eat` int NOT NULL,
  `max_supported_cats` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_config`
--

LOCK TABLES `system_config` WRITE;
/*!40000 ALTER TABLE `system_config` DISABLE KEYS */;
INSERT INTO `system_config` VALUES (1,12,3,5,2,10),(2,12,3,5,2,10),(3,12,3,6,1,10),(4,12,3,6,1,10),(5,12,3,6,1,10),(6,12,3,5,4,10);
/*!40000 ALTER TABLE `system_config` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_config_cat`
--

DROP TABLE IF EXISTS `system_config_cat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config_cat` (
  `cat_color` varchar(50) NOT NULL,
  `alert_no_cat` int NOT NULL DEFAULT '12',
  `alert_no_excrete_min` int NOT NULL DEFAULT '3',
  `alert_no_excrete_max` int NOT NULL DEFAULT '5',
  `alert_no_eat` int NOT NULL DEFAULT '2',
  `max_supported_cats` int NOT NULL DEFAULT '10',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`cat_color`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_config_cat`
--

LOCK TABLES `system_config_cat` WRITE;
/*!40000 ALTER TABLE `system_config_cat` DISABLE KEYS */;
INSERT INTO `system_config_cat` VALUES ('Black',1,3,5,3,10,'2026-01-10 03:40:28'),('Orange',12,3,6,2,10,'2026-01-12 16:23:26'),('pink',1,2,3,1,10,'2026-02-10 22:39:26');
/*!40000 ALTER TABLE `system_config_cat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `timeslot`
--

DROP TABLE IF EXISTS `timeslot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timeslot` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `slot` time NOT NULL,
  `pink_cam` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pink_ac` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `green_cam` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `green_ac` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `yellow_cam` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `yellow_ac` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `video_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pink` enum('F','NF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NF',
  `green` enum('F','NF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NF',
  `yellow` enum('F','NF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NF',
  `orange` enum('F','NF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NF',
  `red` enum('F','NF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NF',
  `orange_ac` enum('eat','excrete','NO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NO',
  `orange_cam` enum('C1','C2','C3','C4') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `red_ac` enum('eat','excrete','NO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NO',
  `red_cam` enum('C1','C2','C3','C4') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `timeslot`
--

LOCK TABLES `timeslot` WRITE;
/*!40000 ALTER TABLE `timeslot` DISABLE KEYS */;
INSERT INTO `timeslot` VALUES (1,'2026-02-10','23:47:00','C1','NO','C1','NO','C1','eat','2026-02-10 09:48:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(2,'2026-02-11','05:34:00','C1','eat','C1','NO','C1','eat','2026-02-10 15:35:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(3,'2026-02-11','06:33:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:34:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(4,'2026-02-11','06:34:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:35:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(5,'2026-02-11','06:35:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:36:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(6,'2026-02-11','06:36:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:37:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(7,'2026-02-11','06:37:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:38:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(8,'2026-02-11','06:38:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:39:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(9,'2026-02-11','06:39:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:40:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(10,'2026-02-11','06:40:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:41:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(11,'2026-02-11','06:41:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:42:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(12,'2026-02-11','06:42:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:43:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(13,'2026-02-11','06:43:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:44:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(14,'2026-02-11','06:44:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:45:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(15,'2026-02-11','06:45:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:46:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(16,'2026-02-11','06:46:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:47:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(17,'2026-02-11','06:47:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:48:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(18,'2026-02-11','06:48:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:49:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(19,'2026-02-11','06:49:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:50:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(20,'2026-02-11','06:50:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:51:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(21,'2026-02-11','06:51:00','C1','NO','C1','NO','C1','NO','2026-02-10 16:52:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL),(22,'2026-02-11','06:52:00','C1','eat','C1','NO','C1','eat','2026-02-10 16:53:00',NULL,'NF','NF','NF','NF','NF','NO',NULL,'NO',NULL);
/*!40000 ALTER TABLE `timeslot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tmp_nums`
--

DROP TABLE IF EXISTS `tmp_nums`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tmp_nums` (
  `n` int NOT NULL,
  PRIMARY KEY (`n`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tmp_nums`
--

LOCK TABLES `tmp_nums` WRITE;
/*!40000 ALTER TABLE `tmp_nums` DISABLE KEYS */;
INSERT INTO `tmp_nums` VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15),(16),(17),(18),(19),(20),(21),(22),(23),(24),(25),(26),(27),(28),(29),(30);
/*!40000 ALTER TABLE `tmp_nums` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'user',
  `is_approved` tinyint(1) NOT NULL DEFAULT '0',
  `approved_at` datetime DEFAULT NULL,
  `reset_token_hash` varchar(64) DEFAULT NULL,
  `reset_token_expires` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'KAMONRAT ONTHONG','07125esc041@gmail.com','scrypt:32768:8:1$Zx3TBwBrWmn7W5Ny$8ceb00d0b3b00c353658d0aa3500a70297931fe54907ffff72b5f529470dc603dd306f5e841fc1ec049f457fc5b0736ef7c5319400ad8e8a0929446ee8887d5d','admin',1,'2026-02-03 22:59:21',NULL,NULL,'2026-02-03 15:58:30','2026-02-03 15:59:21'),(2,'namfon','kmrontong@gmail.com','scrypt:32768:8:1$guPjDqKNQiEtelFP$88ec6fa51335e5723ee3eb749c8cafe2014a72c1a149200813b64e2d32be9e9e8a471d4272c43a5aa19f96f93d39c33cebfe95a0ff7595b613f43e9ae30b183b','user',1,'2026-02-04 00:13:08','c74b1ba3673ba7bc93613626f4b32f822ede1e8f38eccc641471897e9ca6a943','2026-02-03 17:52:02','2026-02-03 17:09:14','2026-02-03 17:22:01');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-26 22:11:57
