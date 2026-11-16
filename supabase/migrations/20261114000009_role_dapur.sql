-- Migrasi NutriCare: Perluas role dengan 'dapur' pada profiles, push_subscriptions, dan notifications

-- 1. Tabel profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('logistik', 'ahli-gizi', 'perawat', 'waiter', 'dapur'));

-- 2. Tabel push_subscriptions (jika tabel ada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_subscriptions') THEN
    ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_role_check;
    ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_role_check
      CHECK (role IN ('ahli-gizi', 'perawat', 'waiter', 'logistik', 'dapur'));
  END IF;
END $$;

-- 3. Tabel notifications (jika tabel ada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_role_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_role_check
      CHECK (role IN ('ahli-gizi', 'perawat', 'waiter', 'logistik', 'dapur'));
  END IF;
END $$;
