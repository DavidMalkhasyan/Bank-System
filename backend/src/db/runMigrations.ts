import { pool } from './index.js';
import { runMigrations } from './migrations.js';

runMigrations()
  .then(() => console.log('Database migrations completed successfully.'))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
