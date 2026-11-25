import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../lib/db';

async function runTest() {
  console.log('\n======================================================');
  console.log('   VEST POSTGRESQL DATABASE CONNECTION TEST (VPS)     ');
  console.log('======================================================\n');
  console.log(`Target Host: ${process.env.DB_HOST || '127.0.0.1'}`);
  console.log(`Target Port: ${process.env.DB_PORT || 5432}`);
  console.log(`Database:    ${process.env.DB_NAME || 'vest_db'}`);
  console.log(`Username:    ${process.env.DB_USER || 'vest_user'}`);
  console.log(`Password:    ${process.env.DB_PASSWORD ? '******** (configured in .env)' : '[NOT SET / EMPTY]'}\n`);

  console.log('Attempting connection to PostgreSQL...');

  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT current_database(), current_user, NOW();');
    const elapsed = Date.now() - startTime;

    console.log('\n✅ Database connection SUCCESSFUL!\n');
    console.table([
      {
        'Current Database': result.rows[0].current_database,
        'Current User': result.rows[0].current_user,
        'Server Timestamp': result.rows[0].now,
        'Ping Time': `${elapsed}ms`,
      },
    ]);

    const versionResult = await pool.query('SELECT version();');
    console.log(`Server Version: ${versionResult.rows[0].version}\n`);
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Database connection FAILED!\n');
    console.error(`Error Code:    ${error.code || 'UNKNOWN'}`);
    console.error(`Error Message: ${error.message}\n`);

    if (error.code === 'ECONNREFUSED') {
      console.log('💡 TIP: Connection refused at ' + (process.env.DB_HOST || '127.0.0.1') + ':' + (process.env.DB_PORT || 5432));
      console.log('   1. If your app is running LOCALLY and your database is on Hostzop VPS:');
      console.log('      - Use an SSH tunnel: ssh -N -L 5432:127.0.0.1:5432 root@YOUR_VPS_IP');
      console.log('      - OR set DB_HOST="YOUR_VPS_PUBLIC_IP" in .env (ensure postgresql.conf and pg_hba.conf allow remote access).');
      console.log('   2. If your app is running DIRECTLY ON the Hostzop VPS:');
      console.log('      - Ensure PostgreSQL service is active: sudo systemctl status postgresql');
    } else if (error.code === '28P01') {
      console.log('💡 TIP: Password authentication failed for user "' + (process.env.DB_USER || 'vest_user') + '".');
      console.log('   - Verify DB_PASSWORD in your .env matches the password configured in PostgreSQL on the VPS.');
    } else if (error.code === '3D000') {
      console.log('💡 TIP: Database "' + (process.env.DB_NAME || 'vest_db') + '" does not exist.');
      console.log('   - Create it using: sudo -u postgres createdb -O vest_user vest_db');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
