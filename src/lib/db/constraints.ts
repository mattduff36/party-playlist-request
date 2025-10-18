import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * Database Constraints and Validation Rules
 * 
 * This file contains all database constraints, triggers, and validation rules
 * to ensure data integrity and business logic enforcement.
 */

export class DatabaseConstraints {
  /**
   * Create all database constraints
   */
  static async createAllConstraints() {
    console.log('🔒 Creating database constraints...');
    
    const constraints: Array<{
      name: string;
      table: string;
      type: 'check' | 'unique' | 'foreign_key';
      definition: string;
      description: string;
    }> = [
      // Events table constraints
      {
        name: 'events_status_check',
        table: 'events',
        type: 'check',
        definition: "status IN ('offline', 'standby', 'live')",
        description: 'Ensure event status is valid'
      },
      {
        name: 'events_version_positive',
        table: 'events',
        type: 'check',
        definition: 'version >= 0',
        description: 'Ensure version is non-negative'
      },

      // Admins table constraints
      {
        name: 'admins_email_format',
        table: 'admins',
        type: 'check',
        definition: "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
        description: 'Ensure email format is valid'
      },
      {
        name: 'admins_password_length',
        table: 'admins',
        type: 'check',
        definition: 'length(password_hash) >= 60',
        description: 'Ensure password hash is properly hashed (bcrypt minimum)'
      },

      // Spotify tokens table constraints
      {
        name: 'spotify_tokens_expires_future',
        table: 'spotify_tokens',
        type: 'check',
        definition: 'expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP',
        description: 'Ensure expires_at is in the future or NULL'
      },
      {
        name: 'spotify_tokens_scope_format',
        table: 'spotify_tokens',
        type: 'check',
        definition: "scope IS NULL OR scope ~ '^[a-z-]+( [a-z-]+)*$'",
        description: 'Ensure scope follows Spotify format'
      },

      // Requests table constraints
      {
        name: 'requests_status_check',
        table: 'requests',
        type: 'check',
        definition: "status IN ('pending', 'approved', 'rejected', 'played')",
        description: 'Ensure request status is valid'
      },
      {
        name: 'requests_duration_positive',
        table: 'requests',
        type: 'check',
        definition: "(track_data->>'duration_ms')::integer > 0",
        description: 'Ensure track duration is positive'
      },
      {
        name: 'requests_approved_at_logic',
        table: 'requests',
        type: 'check',
        definition: "(status = 'approved' AND approved_at IS NOT NULL) OR (status != 'approved' AND approved_at IS NULL)",
        description: 'Ensure approved_at is set only for approved requests'
      },
      {
        name: 'requests_rejected_at_logic',
        table: 'requests',
        type: 'check',
        definition: "(status = 'rejected' AND rejected_at IS NOT NULL) OR (status != 'rejected' AND rejected_at IS NULL)",
        description: 'Ensure rejected_at is set only for rejected requests'
      },
      {
        name: 'requests_played_at_logic',
        table: 'requests',
        type: 'check',
        definition: "(status = 'played' AND played_at IS NOT NULL) OR (status != 'played' AND played_at IS NULL)",
        description: 'Ensure played_at is set only for played requests'
      },
      {
        name: 'requests_idempotency_unique_per_event',
        table: 'requests',
        type: 'unique',
        definition: '(event_id, idempotency_key)',
        description: 'Ensure idempotency key is unique per event'
      }
    ];

    const results: Array<Record<string, any>> = [];
    
    for (const constraint of constraints) {
      try {
        await this.createConstraint(constraint);
        results.push({ ...constraint, status: 'created' });
        console.log(`✅ Created constraint: ${constraint.name}`);
      } catch (error) {
        results.push({ ...constraint, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Failed to create constraint: ${constraint.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`\n📊 Constraint creation summary: ${results.filter(r => r.status === 'created').length} created, ${results.filter(r => r.status === 'failed').length} failed`);
    
    return results;
  }

  /**
   * Create a single constraint
   */
  static async createConstraint(constraintDef: {
    name: string;
    table: string;
    type: 'check' | 'unique' | 'foreign_key';
    definition: string;
    description?: string;
  }) {
    const { name, table, type, definition } = constraintDef;
    
    let constraintSql: string;
    
    switch (type) {
      case 'check':
        constraintSql = `ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${definition})`;
        break;
      case 'unique':
        constraintSql = `ALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE (${definition})`;
        break;
      case 'foreign_key':
        constraintSql = `ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${definition})`;
        break;
      default:
        throw new Error(`Unknown constraint type: ${type}`);
    }

    await db.execute(sql.raw(constraintSql as any));
  }

  /**
   * Create database triggers for business logic
   */
  static async createTriggers() {
    console.log('⚡ Creating database triggers...');
    
    const triggers = [
      // Event version increment trigger
      {
        name: 'increment_event_version',
        table: 'events',
        function: 'increment_event_version_trigger',
        description: 'Automatically increment version on event updates'
      },
      // Request status change audit trigger
      {
        name: 'audit_request_status_change',
        table: 'requests',
        function: 'audit_request_status_change_trigger',
        description: 'Audit request status changes for tracking'
      },
      // Spotify token expiration cleanup trigger
      {
        name: 'cleanup_expired_tokens',
        table: 'spotify_tokens',
        function: 'cleanup_expired_tokens_trigger',
        description: 'Clean up expired Spotify tokens'
      }
    ];

    // Create trigger functions first
    await this.createTriggerFunctions();
    
    const results = [];
    
    for (const trigger of triggers) {
      try {
        await this.createTrigger(trigger);
        results.push({ ...trigger, status: 'created' });
        console.log(`✅ Created trigger: ${trigger.name}`);
      } catch (error) {
        results.push({ ...trigger, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Failed to create trigger: ${trigger.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`\n📊 Trigger creation summary: ${results.filter(r => r.status === 'created').length} created, ${results.filter(r => r.status === 'failed').length} failed`);
    
    return results;
  }

  /**
   * Create trigger functions
   */
  static async createTriggerFunctions() {
    const functions = [
      // Event version increment function
      {
        name: 'increment_event_version_trigger',
        definition: `
          CREATE OR REPLACE FUNCTION increment_event_version_trigger()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.version = OLD.version + 1;
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      // Request status audit function
      {
        name: 'audit_request_status_change_trigger',
        definition: `
          CREATE OR REPLACE FUNCTION audit_request_status_change_trigger()
          RETURNS TRIGGER AS $$
          BEGIN
            IF OLD.status IS DISTINCT FROM NEW.status THEN
              -- Log status change (could be stored in audit table)
              RAISE NOTICE 'Request % status changed from % to %', NEW.id, OLD.status, NEW.status;
            END IF;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      // Token cleanup function
      {
        name: 'cleanup_expired_tokens_trigger',
        definition: `
          CREATE OR REPLACE FUNCTION cleanup_expired_tokens_trigger()
          RETURNS TRIGGER AS $$
          BEGIN
            -- This could be called periodically to clean up expired tokens
            DELETE FROM spotify_tokens 
            WHERE expires_at IS NOT NULL 
            AND expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day';
            RETURN NULL;
          END;
          $$ LANGUAGE plpgsql;
        `
      }
    ];

    for (const func of functions) {
      try {
        await db.execute(sql.raw(func.definition));
        console.log(`✅ Created function: ${func.name}`);
      } catch (error) {
        console.log(`❌ Failed to create function: ${func.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Create a single trigger
   */
  static async createTrigger(triggerDef: {
    name: string;
    table: string;
    function: string;
    description?: string;
  }) {
    const { name, table, function: functionName } = triggerDef;
    
    const triggerSql = `
      CREATE OR REPLACE TRIGGER ${name}
      BEFORE UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION ${functionName}();
    `;

    await db.execute(sql.raw(triggerSql));
  }

  /**
   * Create data validation rules
   */
  static async createValidationRules() {
    console.log('✅ Creating data validation rules...');
    
    const rules = [
      {
        name: 'validate_event_config_structure',
        description: 'Ensure event config has required fields',
        query: `
          SELECT id FROM events 
          WHERE NOT (config ? 'pages_enabled' AND config ? 'event_title')
        `
      },
      {
        name: 'validate_track_data_structure',
        description: 'Ensure track data has required fields',
        query: `
          SELECT id FROM requests 
          WHERE NOT (
            track_data ? 'name' AND 
            track_data ? 'artists' AND 
            track_data ? 'duration_ms'
          )
        `
      },
      {
        name: 'validate_request_timestamps',
        description: 'Ensure request timestamps are logical',
        query: `
          SELECT id FROM requests 
          WHERE (
            (approved_at IS NOT NULL AND approved_at < created_at) OR
            (rejected_at IS NOT NULL AND rejected_at < created_at) OR
            (played_at IS NOT NULL AND played_at < COALESCE(approved_at, created_at))
          )
        `
      }
    ];

    const results = [];
    
    for (const rule of rules) {
      try {
        const result = await db.execute(sql.raw(rule.query));
        if (result.rows.length > 0) {
          results.push({ ...rule, status: 'violations_found', count: result.rows.length });
          console.log(`⚠️  Validation rule ${rule.name}: ${result.rows.length} violations found`);
        } else {
          results.push({ ...rule, status: 'passed' });
          console.log(`✅ Validation rule ${rule.name}: passed`);
        }
      } catch (error) {
        results.push({ ...rule, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Validation rule ${rule.name}: failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Drop all constraints and triggers
   */
  static async dropAllConstraints() {
    console.log('🗑️  Dropping all constraints and triggers...');
    
    const constraints = [
      'events_status_check',
      'events_version_positive',
      'admins_email_format',
      'admins_password_length',
      'spotify_tokens_expires_future',
      'spotify_tokens_scope_format',
      'requests_status_check',
      'requests_duration_positive',
      'requests_approved_at_logic',
      'requests_rejected_at_logic',
      'requests_played_at_logic',
      'requests_idempotency_unique_per_event'
    ];

    const triggers = [
      'increment_event_version',
      'audit_request_status_change',
      'cleanup_expired_tokens'
    ];

    const results = [];
    
    // Drop triggers first
    for (const trigger of triggers) {
      try {
        await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${trigger} ON events, requests, spotify_tokens`));
        results.push({ name: trigger, type: 'trigger', status: 'dropped' });
        console.log(`✅ Dropped trigger: ${trigger}`);
      } catch (error) {
        results.push({ name: trigger, type: 'trigger', status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Failed to drop trigger: ${trigger}`);
      }
    }

    // Drop constraints
    for (const constraint of constraints) {
      try {
        await db.execute(sql.raw(`ALTER TABLE events, admins, spotify_tokens, requests DROP CONSTRAINT IF EXISTS ${constraint}`));
        results.push({ name: constraint, type: 'constraint', status: 'dropped' });
        console.log(`✅ Dropped constraint: ${constraint}`);
      } catch (error) {
        results.push({ name: constraint, type: 'constraint', status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Failed to drop constraint: ${constraint}`);
      }
    }

    console.log(`\n📊 Drop summary: ${results.filter(r => r.status === 'dropped').length} dropped, ${results.filter(r => r.status === 'failed').length} failed`);
    
    return results;
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      DatabaseConstraints.createAllConstraints()
        .then(() => DatabaseConstraints.createTriggers())
        .then(() => DatabaseConstraints.createValidationRules())
        .then(() => console.log('✅ All constraints created successfully'))
        .catch(error => {
          console.error('❌ Constraint creation failed:', error);
          process.exit(1);
        });
      break;
      
    case 'drop':
      DatabaseConstraints.dropAllConstraints()
        .then(() => console.log('✅ All constraints dropped successfully'))
        .catch(error => {
          console.error('❌ Constraint drop failed:', error);
          process.exit(1);
        });
      break;
      
    case 'validate':
      DatabaseConstraints.createValidationRules()
        .then(() => console.log('✅ Validation completed'))
        .catch(error => {
          console.error('❌ Validation failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log(`
Database Constraints Manager

Usage: tsx constraints.ts <command>

Commands:
  create      Create all constraints and triggers
  drop        Drop all constraints and triggers
  validate    Run data validation rules

Examples:
  tsx constraints.ts create
  tsx constraints.ts validate
      `);
  }
}
