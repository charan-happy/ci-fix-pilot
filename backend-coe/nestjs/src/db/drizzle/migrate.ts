import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

async function runMigrations() {
  const client = new Client({
    connectionString: process.env['DATABASE_URL'],
  });

  await client.connect();
  const db = drizzle(client);

  console.log('Running migrations...');

  await migrate(db, {
    migrationsFolder: './src/db/drizzle/migrations',
  });

  console.log('Migrations completed successfully.');
  await client.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
