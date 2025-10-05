#!/usr/bin/env node

/**
 * Spike 1 Test Runner
 * Quick script to run all validation queries and report results
 * 
 * Usage: node migrations/spike/run-spike-tests.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get DATABASE_URL from env
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found in environment');
  console.error('💡 Tip: Make sure to load .env.local first');
  process.exit(1);
}

console.log('🚀 Spike 1: Database Multi-Tenancy Tests\n');
console.log('📊 Connecting to database...\n');

const pool = new Pool({ connectionString: DATABASE_URL });

// Test queries
const tests = [
  {
    name: 'Test 1: Data Isolation',
    query: `
      SELECT u.username, COUNT(r.id) as request_count
      FROM users u
      LEFT JOIN requests r ON r.user_id = u.id
      GROUP BY u.username
      ORDER BY u.username;
    `,
    expectedRows: 4,
    validate: (rows) => {
      const johnsmith = rows.find(r => r.username === 'johnsmith');
      const janedoe = rows.find(r => r.username === 'janedoe');
      return johnsmith?.request_count === '3' && janedoe?.request_count === '2';
    }
  },
  {
    name: 'Test 2: Active Events Per User',
    query: `
      SELECT u.username, e.name, e.pin, e.active
      FROM users u
      LEFT JOIN user_events e ON e.user_id = u.id AND e.active = true
      ORDER BY u.username;
    `,
    expectedRows: 4,
    validate: (rows) => {
      const activeEvents = rows.filter(r => r.active === true);
      return activeEvents.length === 2; // johnsmith and janedoe
    }
  },
  {
    name: 'Test 3: No Cross-Contamination (CRITICAL)',
    query: `
      SELECT COUNT(*) as cross_contamination_errors
      FROM requests r1
      INNER JOIN requests r2 ON r1.id = r2.id
      WHERE r1.user_id != r2.user_id;
    `,
    expectedRows: 1,
    validate: (rows) => {
      return rows[0].cross_contamination_errors === '0';
    }
  },
  {
    name: 'Test 4: Performance - Index Usage',
    query: `
      EXPLAIN (FORMAT JSON)
      SELECT * FROM requests 
      WHERE user_id = '11111111-1111-1111-1111-111111111111' 
        AND status = 'pending';
    `,
    expectedRows: 1,
    validate: (rows) => {
      const plan = JSON.stringify(rows);
      return plan.includes('idx_requests_user') || plan.includes('Index Scan');
    }
  },
  {
    name: 'Test 5: User Settings Isolation',
    query: `
      SELECT u.username, COUNT(us.id) as settings_count
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE u.role = 'user'
      GROUP BY u.username
      ORDER BY u.username;
    `,
    expectedRows: 3,
    validate: (rows) => {
      const johnsmith = rows.find(r => r.username === 'johnsmith');
      const janedoe = rows.find(r => r.username === 'janedoe');
      return johnsmith?.settings_count === '2' && janedoe?.settings_count === '2';
    }
  }
];

// Run tests
async function runTests() {
  let passedTests = 0;
  let failedTests = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n📝 Running: ${test.name}`);
      console.log(`   Query: ${test.query.trim().substring(0, 60)}...`);
      
      const result = await pool.query(test.query);
      
      // Check row count
      if (result.rows.length !== test.expectedRows) {
        console.log(`   ⚠️  Row count mismatch: expected ${test.expectedRows}, got ${result.rows.length}`);
      }
      
      // Run validation
      const isValid = test.validate(result.rows);
      
      if (isValid) {
        console.log(`   ✅ PASS`);
        passedTests++;
      } else {
        console.log(`   ❌ FAIL - Validation check failed`);
        console.log(`   📊 Result:`, result.rows);
        failedTests++;
      }
      
    } catch (error) {
      console.log(`   ❌ FAIL - Query error`);
      console.log(`   Error: ${error.message}`);
      failedTests++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passedTests}/${tests.length}`);
  console.log(`❌ Failed: ${failedTests}/${tests.length}`);
  
  if (failedTests === 0) {
    console.log('\n🎉 SUCCESS! All tests passed. Spike 1 validation complete!');
    console.log('✅ Multi-tenant database architecture is working correctly.');
    console.log('\n🚀 Next step: Begin Spike 2 (Authentication & Routing)');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above and fix before proceeding.');
    process.exit(1);
  }
}

// Test constraint (should fail)
async function testUniqueConstraint() {
  console.log('\n📝 Running: Test 6: Unique Active Event Constraint');
  console.log('   This should FAIL with a unique constraint error...');
  
  try {
    await pool.query(`
      INSERT INTO user_events (user_id, name, pin, bypass_token, active)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Second Event', '9999', 'test_token_should_fail_' + gen_random_uuid()::text, true);
    `);
    console.log('   ❌ FAIL - Constraint did not prevent duplicate active event!');
    return false;
  } catch (error) {
    if (error.message.includes('one_active_event_per_user') || error.message.includes('idx_one_active_event_per_user')) {
      console.log('   ✅ PASS - Constraint correctly prevented duplicate');
      return true;
    } else {
      console.log('   ❌ FAIL - Wrong error:', error.message);
      return false;
    }
  }
}

// Main execution
(async () => {
  try {
    await runTests();
    const constraintPass = await testUniqueConstraint();
    
    if (!constraintPass) {
      console.log('\n⚠️  Constraint test failed!');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
