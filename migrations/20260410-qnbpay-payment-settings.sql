-- QNBpay kolonları ve payment_attempts.provider enum genişlemesi (PostgreSQL)
-- Çalıştırmadan önce yedek alın; TypeORM synchronize açıksa bu dosya isteğe bağlıdır.

ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS "qnbpayAppId" character varying,
  ADD COLUMN IF NOT EXISTS "qnbpayAppSecret" character varying,
  ADD COLUMN IF NOT EXISTS "qnbpayMerchantKey" character varying,
  ADD COLUMN IF NOT EXISTS "qnbpayMerchantId" character varying,
  ADD COLUMN IF NOT EXISTS "qnbpayBaseUrl" character varying,
  ADD COLUMN IF NOT EXISTS "qnbpayEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "qnbpayCheckoutMode" character varying DEFAULT 'hosted_link',
  ADD COLUMN IF NOT EXISTS "qnbpaySaleWebhookKey" character varying;

-- payment_attempts.provider tipi enum ise (örnek isim: payment_attempts_provider_enum):
-- ALTER TYPE payment_attempts_provider_enum ADD VALUE IF NOT EXISTS 'QNBPAY';
