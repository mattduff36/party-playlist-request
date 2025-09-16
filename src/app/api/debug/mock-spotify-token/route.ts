import { NextRequest, NextResponse } from 'next/server';

// Mock Spotify token endpoint for local testing
export async function POST(req: NextRequest) {
  try {
    // Handle both JSON and form-urlencoded data
    const contentType = req.headers.get('content-type');
    let body;
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await req.text();
      const params = new URLSearchParams(formData);
      body = {
        grant_type: params.get('grant_type'),
        code: params.get('code'),
        redirect_uri: params.get('redirect_uri'),
        client_id: params.get('client_id'),
        code_verifier: params.get('code_verifier')
      };
    } else {
      body = await req.json();
    }
    
    const { grant_type, code, redirect_uri, client_id, code_verifier } = body;
    
    console.log('🧪 MOCK Spotify Token Exchange:', {
      grant_type,
      hasCode: !!code,
      hasCodeVerifier: !!code_verifier,
      client_id,
      redirect_uri
    });

    // Simulate different scenarios based on code
    if (code === 'invalid_grant_test') {
      return NextResponse.json({
        error: 'invalid_grant',
        error_description: 'Authorization code expired'
      }, { status: 400 });
    }

    if (code === 'invalid_client_test') {
      return NextResponse.json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      }, { status: 401 });
    }

    // Return mock successful token response
    const mockTokenResponse = {
      access_token: 'mock_access_token_' + Date.now(),
      token_type: 'Bearer',
      scope: 'user-modify-playback-state playlist-modify-private playlist-read-private user-read-playback-state user-read-currently-playing user-read-private',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token_' + Date.now()
    };

    console.log('✅ MOCK Token Response:', mockTokenResponse);
    return NextResponse.json(mockTokenResponse);

  } catch (error) {
    console.error('❌ MOCK Token Exchange Error:', error);
    return NextResponse.json({
      error: 'server_error',
      error_description: 'Internal server error'
    }, { status: 500 });
  }
}
