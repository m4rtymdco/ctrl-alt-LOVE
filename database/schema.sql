CREATE DATABASE IF NOT EXISTS ctrl_alt_love
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ctrl_alt_love;

CREATE TABLE IF NOT EXISTS tracks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  lyrics TEXT,
  audio_mime VARCHAR(120) DEFAULT NULL,
  audio_data LONGBLOB,
  audio_url VARCHAR(1000) DEFAULT NULL,
  photo_mime VARCHAR(120) DEFAULT NULL,
  photo_data LONGBLOB,
  photo_url VARCHAR(1000) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO tracks (title, artist, audio_url, photo_url)
SELECT * FROM (
  SELECT
    'Neon Horizon' AS title,
    'Ctrl+Alt+Love' AS artist,
    'media/demo/song1.mp3' AS audio_url,
    'media/demo/cover1.jpg' AS photo_url
  UNION ALL
  SELECT
    'Digital Heartbeat',
    'Synthwave Dreams',
    'media/demo/song1.mp3',
    'media/demo/cover2.jpg'
  UNION ALL
  SELECT
    'Midnight Protocol',
    'Love & Algorithms',
    'media/demo/song1.mp3',
    'media/demo/cover3.jpg'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM tracks LIMIT 1);
