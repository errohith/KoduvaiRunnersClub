// Unit tests never touch the database; provide a minimal valid configuration.
process.env.APP_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://unit:unit@localhost:5432/unit";
process.env.AUTH_SECRET = "unit-test-secret-unit-test-secret-0123456789";
process.env.APP_TIMEZONE = "Asia/Kolkata";
process.env.NOTIFICATIONS_INLINE = "false";
