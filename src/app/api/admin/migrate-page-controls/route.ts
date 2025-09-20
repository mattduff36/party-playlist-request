import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Require admin authentication
    await authService.requireAdminAuth(req);
    
    const client = getPool();
    
    // Ensure the page control columns exist with correct defaults
    await client.query(`
      ALTER TABLE event_settings 
      ADD COLUMN IF NOT EXISTS requests_page_enabled BOOLEAN DEFAULT FALSE;
    `);
    
    await client.query(`
      ALTER TABLE event_settings 
      ADD COLUMN IF NOT EXISTS display_page_enabled BOOLEAN DEFAULT FALSE;
    `);
    
    // Update any existing NULL values to FALSE
    await client.query(`
      UPDATE event_settings 
      SET requests_page_enabled = FALSE 
      WHERE requests_page_enabled IS NULL;
    `);
    
    await client.query(`
      UPDATE event_settings 
      SET display_page_enabled = FALSE 
      WHERE display_page_enabled IS NULL;
    `);
    
    // Ensure there's at least one row in event_settings
    await client.query(`
      INSERT INTO event_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log('✅ Page control migration completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Page control columns migrated successfully'
    });
    
  } catch (error) {
    console.error('Error migrating page controls:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { 
        error: 'Failed to migrate page controls',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
