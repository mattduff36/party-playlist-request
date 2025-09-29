#!/usr/bin/env tsx

/**
 * Database Migration Runner
 * 
 * This script runs the complete migration from 7-table to 4-table schema.
 * It includes validation, backup creation, data migration, and rollback capabilities.
 */

import { DataMigration } from './migrate-data';
import { db } from '../index';

interface MigrationOptions {
  dryRun?: boolean;
  skipBackup?: boolean;
  validateOnly?: boolean;
  rollback?: boolean;
}

class MigrationRunner {
  private migration: DataMigration;

  constructor() {
    this.migration = new DataMigration();
  }

  async run(options: MigrationOptions = {}) {
    console.log('🚀 Starting Database Migration');
    console.log('================================');
    console.log(`Options:`, options);
    console.log('');

    try {
      if (options.rollback) {
        return await this.rollback();
      }

      if (options.validateOnly) {
        return await this.validateOnly();
      }

      if (options.dryRun) {
        return await this.dryRun();
      }

      // Full migration
      const results = await this.migration.runFullMigration();
      
      console.log('\n📊 Migration Summary:');
      console.log('====================');
      
      let successCount = 0;
      let failCount = 0;
      
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.message}`);
        
        if (result.error) {
          console.log(`   Error: ${result.error}`);
          failCount++;
        } else {
          successCount++;
        }
        
        if (result.data && typeof result.data === 'object') {
          console.log(`   Data:`, JSON.stringify(result.data, null, 2));
        }
      });

      console.log(`\n📈 Results: ${successCount} successful, ${failCount} failed`);
      
      if (failCount > 0) {
        console.log('\n⚠️  Migration completed with errors. Please review the results.');
        return false;
      } else {
        console.log('\n🎉 Migration completed successfully!');
        return true;
      }

    } catch (error) {
      console.error('\n💥 Migration failed with error:', error);
      return false;
    }
  }

  async dryRun() {
    console.log('🔍 Running dry run validation...');
    
    const validation = await this.migration.validateOldTables();
    console.log('Old tables validation:', validation);
    
    if (!validation.success) {
      console.error('❌ Dry run failed: Old tables validation failed');
      return false;
    }

    console.log('✅ Dry run completed successfully');
    console.log('📊 Old table counts:', validation.data);
    return true;
  }

  async validateOnly() {
    console.log('🔍 Running migration validation...');
    
    const validation = await this.migration.validateMigration();
    console.log('Migration validation:', validation);
    
    if (!validation.success) {
      console.error('❌ Validation failed');
      return false;
    }

    console.log('✅ Validation completed successfully');
    console.log('📊 New table counts:', validation.data?.counts);
    console.log('🔒 Data integrity:', validation.data?.integrity);
    return true;
  }

  async rollback() {
    console.log('🔄 Rolling back migration...');
    console.log('⚠️  This will restore the original 7-table schema');
    
    // Note: This would require implementing rollback logic
    // For now, just show what would happen
    console.log('📋 Rollback steps:');
    console.log('1. Restore backup tables');
    console.log('2. Drop new 4-table schema');
    console.log('3. Recreate original indexes');
    console.log('4. Validate rollback');
    
    console.log('⚠️  Rollback not implemented yet. Please restore from backup manually.');
    return false;
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    try {
      // Check database connection
      await db.execute('SELECT 1');
      console.log('✅ Database connection: OK');
      
      // Check if old tables exist
      const oldTables = ['requests', 'settings', 'admins', 'spotify_auth', 'event_settings'];
      for (const table of oldTables) {
        try {
          await db.execute(`SELECT 1 FROM ${table} LIMIT 1`);
          console.log(`✅ Old table ${table}: EXISTS`);
        } catch (error) {
          console.log(`❌ Old table ${table}: MISSING`);
          return false;
        }
      }
      
      // Check if new tables exist
      const newTables = ['events', 'admins', 'spotify_tokens', 'requests'];
      for (const table of newTables) {
        try {
          await db.execute(`SELECT 1 FROM ${table} LIMIT 1`);
          console.log(`✅ New table ${table}: EXISTS`);
        } catch (error) {
          console.log(`⚠️  New table ${table}: MISSING (will be created)`);
        }
      }
      
      console.log('✅ Prerequisites check completed');
      return true;
      
    } catch (error) {
      console.error('❌ Prerequisites check failed:', error);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};
  
  // Parse command line arguments
  for (const arg of args) {
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-backup':
        options.skipBackup = true;
        break;
      case '--validate-only':
        options.validateOnly = true;
        break;
      case '--rollback':
        options.rollback = true;
        break;
      case '--help':
        console.log(`
Database Migration Runner

Usage: tsx run-migration.ts [options]

Options:
  --dry-run        Run validation without making changes
  --skip-backup    Skip creating backup tables
  --validate-only  Only validate existing migration
  --rollback       Rollback to original schema
  --help           Show this help message

Examples:
  tsx run-migration.ts --dry-run
  tsx run-migration.ts --validate-only
  tsx run-migration.ts
        `);
        process.exit(0);
    }
  }

  const runner = new MigrationRunner();
  
  // Check prerequisites first
  const prereqsOk = await runner.checkPrerequisites();
  if (!prereqsOk) {
    console.error('❌ Prerequisites check failed. Exiting.');
    process.exit(1);
  }
  
  // Run migration
  const success = await runner.run(options);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Migration runner failed:', error);
    process.exit(1);
  });
}

export { MigrationRunner };
