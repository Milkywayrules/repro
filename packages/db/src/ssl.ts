type PgSsl = false | { rejectUnauthorized: boolean }

/**
 * Decide Postgres TLS settings from the connection string host.
 * Private Railway network (`*.railway.internal`) and localhost do not use TLS;
 * public managed hosts do. Managed providers with untrusted cert chains may
 * still require `?sslmode=no-verify` in the connection string.
 */
export function resolveSsl(
  connectionString: string,
  forceDisable = false,
): PgSsl {
  if (forceDisable) {
    return false
  }
  try {
    const host = new URL(connectionString).hostname
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.railway.internal')
    ) {
      return false
    }
  } catch {
    return false
  }
  return { rejectUnauthorized: true }
}
