#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

// Try to resolve the hostname
const dns = require('dns');
const host = process.env.SUPABASE_DB_HOST;

console.log('Testing connection to:', host);

// Force IPv4
dns.resolve4(host, (err, addresses) => {
  if (err) {
    console.error('DNS resolution failed:', err);
  } else {
    console.log('IPv4 addresses:', addresses);
    
    // Try connecting with IPv4
    const { Client } = require('pg');
    const client = new Client({
      host: addresses[0], // Use first IPv4 address
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: process.env.SUPABASE_DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false
      }
    });

    client.connect()
      .then(() => {
        console.log('✓ Connected successfully!');
        return client.query('SELECT version()');
      })
      .then(result => {
        console.log('PostgreSQL version:', result.rows[0].version);
        return client.end();
      })
      .catch(err => {
        console.error('Connection error:', err.message);
      });
  }
});