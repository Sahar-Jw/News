export function validateEnv(config: Record<string, any>) {
  const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
  const missing = required.filter((k) => config[k] === undefined || config[k] === '');
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (use a long random string).');
  }
  return config;
}
