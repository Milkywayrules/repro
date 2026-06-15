import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core'

export const rateLimit = pgTable(
  'rate_limit',
  {
    key: text('key').notNull(),
    windowStart: bigint('window_start', { mode: 'number' }).notNull(),
    count: integer('count').notNull().default(0),
    expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  },
  table => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index('rate_limit_expires_at_idx').on(table.expiresAt),
  ],
)
