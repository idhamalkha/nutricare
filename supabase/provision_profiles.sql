-- Safe, idempotent profile mapping for existing Supabase Auth users.
-- Review the mappings below before running in Supabase SQL Editor.
-- This script does NOT create/delete Auth users, change passwords, or grant an admin role.
-- Role mapping: gizi -> ahli-gizi; nurse -> perawat. Unknown/admin values are skipped.

BEGIN;

WITH source AS (
  SELECT
    u.id,
    u.email,
    u.raw_user_meta_data,
    CASE lower(coalesce(u.raw_user_meta_data->>'role', ''))
      WHEN 'gizi' THEN 'ahli-gizi'
      WHEN 'nurse' THEN 'perawat'
      WHEN 'ahli-gizi' THEN 'ahli-gizi'
      WHEN 'perawat' THEN 'perawat'
      WHEN 'waiter' THEN 'waiter'
      WHEN 'logistik' THEN 'logistik'
      ELSE NULL
    END AS app_role,
    NULLIF(btrim(coalesce(u.raw_user_meta_data->>'username', '')), '') AS supplied_username,
    NULLIF(btrim(coalesce(
      u.raw_user_meta_data->>'nama',
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      ''
    )), '') AS supplied_name
  FROM auth.users AS u
  WHERE u.email IS NOT NULL
), mapped AS (
  SELECT
    id,
    app_role,
    coalesce(
      supplied_username,
      lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) || '-' || left(replace(id::text, '-', ''), 6)
    ) AS username,
    coalesce(supplied_name, split_part(email, '@', 1)) AS nama
  FROM source
  WHERE app_role IS NOT NULL
)
INSERT INTO public.profiles (id, role, username, nama, telepon, aktif)
SELECT id, app_role, username, nama, '', true
FROM mapped
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification only: counts and role distribution, no emails or credentials.
SELECT
  (SELECT count(*)::integer FROM auth.users) AS auth_users,
  (SELECT count(*)::integer FROM public.profiles) AS profiles,
  (SELECT count(*)::integer FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL) AS unmapped_auth_users;

SELECT role, count(*)::integer AS profiles
FROM public.profiles
GROUP BY role
ORDER BY role;
