import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function POST(req: NextRequest) {
  try {
    console.log('Creating database schema...');
    
    const sql = neon(process.env.DATABASE_URL!);
    
    // Read the SQL file
    const fs = await import('fs');
    const path = await import('path');
    const sqlContent = fs.readFileSync(
      path.join(process.cwd(), 'create-tables.sql'), 
      'utf8'
    );
    
    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await sql.query(statement);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database schema created successfully'
    });

  } catch (error) {
    console.error('Schema creation error:', error);
    return NextResponse.json({ 
      error: 'Schema creation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
