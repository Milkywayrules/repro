type PgSsl = false | { rejectUnauthorized: boolean }

function connectionUrl(connectionString: string): URL | null {
  try {
    return new URL(connectionString)
  } catch {
    return null
  }
}

/**
 * Decide Postgres TLS settings from the connection string host and `sslmode`.
 * Private Railway network (`*.railway.internal`) and localhost do not use TLS;
 * public managed hosts do. Railway public proxy (`*.proxy.rlwy.net`) and
 * `?sslmode=no-verify` skip certificate verification.
 */
export function resolveSsl(
  connectionString: string,
  forceDisable = false,
): PgSsl {
  if (forceDisable) {
    const url = connectionUrl(connectionString)
    const host = url?.hostname
    if (
      !host ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.railway.internal')
    ) {
      return false
    }
  }

  const url = connectionUrl(connectionString)
  if (!url) {
    return false
  }

  const sslmode = url.searchParams.get('sslmode')
  if (sslmode === 'disable') {
    return false
  }
  if (sslmode === 'no-verify') {
    return { rejectUnauthorized: false }
  }

  const host = url.hostname
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.railway.internal')
  ) {
    return false
  }

  if (host.endsWith('.proxy.rlwy.net')) {
    return { rejectUnauthorized: false }
  }

  return { rejectUnauthorized: true }
}
