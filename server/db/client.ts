import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface Database {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sql: postgres.Sql;
  /** Cheap liveness probe used by /health. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(url: string, max = 10): Database {
  // Railway's DATABASE_URL reference points at the private network, so no TLS is needed there.
  const sql = postgres(url, { max, idle_timeout: 20, connect_timeout: 5, onnotice: () => {} });
  return {
    db: drizzle(sql, { schema }),
    sql,
    async ping() {
      await sql`select 1`;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
