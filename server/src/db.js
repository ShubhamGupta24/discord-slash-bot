const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Run once on boot: create tables if they don't exist yet.
async function initDb() {
  console.log('[db] initializing database');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      interaction_id TEXT UNIQUE NOT NULL,
      command_name TEXT NOT NULL,
      user_tag TEXT,
      raw_input TEXT,
      rule_result TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const defaults = [
    ['report', 'urgent,bug,down'],
    ['status', ''],
    ['note', ''],
    ['escalate', 'urgent,critical,down,broken,now'],
    ['ping', ''],
  ];

  for (const [commandName, keywords] of defaults) {
    await pool.query(
      `INSERT INTO command_config (command_name, flagged_keywords)
       VALUES ($1, $2)
       ON CONFLICT (command_name) DO NOTHING;`,
      [commandName, keywords]
    );
  }

  console.log('[db] database initialization complete');
}

module.exports = { pool, initDb };
