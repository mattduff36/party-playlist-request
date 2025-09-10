#!/bin/bash

# Party Playlist Request - Development Setup Script

echo "🎵 Setting up Party Playlist Request development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "🔧 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local with your Spotify credentials"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env.local with your Spotify app credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to see the app"
echo "4. Visit http://localhost:3000/admin for the admin panel"
echo ""
echo "📚 For detailed setup instructions, see:"
echo "   - SPOTIFY-SETUP-GUIDE.md"
echo "   - VERCEL-ONLY-SETUP.md"
echo ""
