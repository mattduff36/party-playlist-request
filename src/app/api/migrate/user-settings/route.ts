import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    
    console.log('🔧 Running user_settings table migration...');
    
    // Drop the old user_settings table if it exists (it has wrong schema)
    console.log('🗑️ Dropping old user_settings table if it exists...');
    await pool.query('DROP TABLE IF EXISTS user_settings CASCADE');
    console.log('✅ Old table dropped');
    
    // Create new user_settings table with correct schema
    console.log('📝 Creating new user_settings table...');
    await pool.query(`
      CREATE TABLE user_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        event_title TEXT DEFAULT 'Party DJ Requests',
        dj_name TEXT DEFAULT '',
        venue_info TEXT DEFAULT '',
        welcome_message TEXT DEFAULT 'Request your favorite songs!',
        secondary_message TEXT DEFAULT 'Your requests will be reviewed by the DJ',
        tertiary_message TEXT DEFAULT 'Keep the party going!',
        show_qr_code BOOLEAN DEFAULT TRUE,
        display_refresh_interval INTEGER DEFAULT 20,
        admin_polling_interval INTEGER DEFAULT 15,
        display_polling_interval INTEGER DEFAULT 10,
        now_playing_polling_interval INTEGER DEFAULT 5,
        sse_update_interval INTEGER DEFAULT 2,
        request_limit INTEGER DEFAULT 10,
        auto_approve BOOLEAN DEFAULT FALSE,
        decline_explicit BOOLEAN DEFAULT FALSE,
        force_polling BOOLEAN DEFAULT FALSE,
        requests_page_enabled BOOLEAN DEFAULT TRUE,
        display_page_enabled BOOLEAN DEFAULT TRUE,
        message_text TEXT DEFAULT NULL,
        message_duration INTEGER DEFAULT NULL,
        message_created_at TIMESTAMP DEFAULT NULL,
        theme_primary_color TEXT DEFAULT NULL,
        theme_secondary_color TEXT DEFAULT NULL,
        theme_tertiary_color TEXT DEFAULT NULL,
        show_scrolling_bar BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ user_settings table created/verified');
    
    // Check if table has rows
    const result = await pool.query('SELECT COUNT(*) as count FROM user_settings');
    const count = parseInt(result.rows[0].count);
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      user_settings_count: count
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

