-- TASK-6 / Admin#6: terminal-tipli jurnalda statusa görə rəngləmə + səviyyə filtri.
-- Səviyyə SÜTUN kimi saxlanılır (client-də ad üzrə təxmin edilmir), çünki
-- filtr serverdə `WHERE` ilə işləməlidir — əks halda pagination pozulardı
-- (səhifə yüklənir, sonra client yarısını atır → "daha çox" düyməsi yalan danışır).

ALTER TABLE admin_logs ADD COLUMN level TEXT NOT NULL DEFAULT 'info';

-- Səviyyə üzrə filtr + zaman sıralaması bir index-dən oxunsun.
CREATE INDEX IF NOT EXISTS idx_admin_logs_level ON admin_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_time  ON admin_logs(created_at DESC, id);

-- Mövcud sətrlərin backfill-i: əməliyyat adından məna çıxarılır.
UPDATE admin_logs SET level = 'error'
  WHERE action LIKE '%remove%' OR action LIKE '%delete%' OR action LIKE '%block%'
     OR action LIKE '%reject%';

UPDATE admin_logs SET level = 'warning'
  WHERE level = 'info'
    AND (action LIKE '%temp-password%' OR action LIKE '%edit%' OR action LIKE '%deactivate%');

UPDATE admin_logs SET level = 'success'
  WHERE level = 'info'
    AND (action LIKE '%add%' OR action LIKE '%create%' OR action LIKE '%approve%'
      OR action LIKE '%verify%' OR action LIKE '%unblock%');
