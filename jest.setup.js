// Set up test environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
