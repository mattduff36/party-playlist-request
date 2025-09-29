-- Migration Validation Script
-- This script validates that the 7-to-4 table migration was successful

-- 1. Validate events table
SELECT 
  'events' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_count,
  COUNT(CASE WHEN status = 'standby' THEN 1 END) as standby_count,
  COUNT(CASE WHEN status = 'live' THEN 1 END) as live_count,
  COUNT(CASE WHEN active_admin_id IS NOT NULL THEN 1 END) as with_admin_count
FROM events;

-- 2. Validate admins table
SELECT 
  'admins' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email_count
FROM admins;

-- 3. Validate spotify_tokens table
SELECT 
  'spotify_tokens' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN access_token IS NOT NULL THEN 1 END) as with_access_token_count
FROM spotify_tokens;

-- 4. Validate requests table
SELECT 
  'requests' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN event_id IS NOT NULL THEN 1 END) as with_event_id_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
  COUNT(CASE WHEN status = 'played' THEN 1 END) as played_count
FROM requests;

-- 5. Validate data integrity
SELECT 
  'data_integrity' as check_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM events) > 0 THEN 'PASS'
    ELSE 'FAIL'
  END as events_exist,
  CASE 
    WHEN (SELECT COUNT(*) FROM admins) > 0 THEN 'PASS'
    ELSE 'FAIL'
  END as admins_exist,
  CASE 
    WHEN (SELECT COUNT(*) FROM requests WHERE event_id IS NOT NULL) = (SELECT COUNT(*) FROM requests) THEN 'PASS'
    ELSE 'FAIL'
  END as all_requests_have_event_id,
  CASE 
    WHEN (SELECT COUNT(*) FROM spotify_tokens WHERE admin_id IS NOT NULL) = (SELECT COUNT(*) FROM spotify_tokens) THEN 'PASS'
    ELSE 'FAIL'
  END as all_tokens_have_admin_id;

-- 6. Validate config data structure
SELECT 
  'config_validation' as check_type,
  CASE 
    WHEN config ? 'pages_enabled' THEN 'PASS'
    ELSE 'FAIL'
  END as has_pages_enabled,
  CASE 
    WHEN config ? 'event_title' THEN 'PASS'
    ELSE 'FAIL'
  END as has_event_title,
  CASE 
    WHEN config ? 'party_playlist_id' THEN 'PASS'
    ELSE 'FAIL'
  END as has_party_playlist_id
FROM events
LIMIT 1;

-- 7. Validate track_data structure
SELECT 
  'track_data_validation' as check_type,
  COUNT(CASE WHEN track_data ? 'name' THEN 1 END) as has_name_count,
  COUNT(CASE WHEN track_data ? 'artists' THEN 1 END) as has_artists_count,
  COUNT(CASE WHEN track_data ? 'album' THEN 1 END) as has_album_count,
  COUNT(CASE WHEN track_data ? 'duration_ms' THEN 1 END) as has_duration_count
FROM requests
LIMIT 10;

-- 8. Compare record counts (old vs new)
SELECT 
  'record_count_comparison' as check_type,
  (SELECT COUNT(*) FROM requests_old) as old_requests_count,
  (SELECT COUNT(*) FROM requests) as new_requests_count,
  (SELECT COUNT(*) FROM admins_old) as old_admins_count,
  (SELECT COUNT(*) FROM admins) as new_admins_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM requests_old) = (SELECT COUNT(*) FROM requests) THEN 'PASS'
    ELSE 'FAIL'
  END as requests_count_match,
  CASE 
    WHEN (SELECT COUNT(*) FROM admins_old) = (SELECT COUNT(*) FROM admins) THEN 'PASS'
    ELSE 'FAIL'
  END as admins_count_match;
