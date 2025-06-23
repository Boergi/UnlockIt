#!/bin/bash

# UnlockIt Production Deployment Script
echo "🚀 Starting UnlockIt Production Deployment..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy env.example to .env and configure your production settings."
    exit 1
fi

# Check if NODE_ENV is set to production
if ! grep -q "NODE_ENV=production" .env; then
    echo "⚠️  Warning: NODE_ENV is not set to 'production' in .env file"
    echo "Please set NODE_ENV=production for optimal performance and security."
fi

# Install all dependencies
echo "📦 Installing dependencies..."
npm run install:all

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migrate

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed"
    exit 1
fi

# Build React app
echo "🏗️  Building React application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ React build failed"
    exit 1
fi

# Create uploads directory if it doesn't exist
if [ ! -d "uploads" ]; then
    echo "📁 Creating uploads directory..."
    mkdir -p uploads
fi

echo "✅ Deployment completed successfully!"
echo ""
echo "🎯 To start the production server:"
echo "   npm start"
echo ""
echo "🔗 Or use the combined command:"
echo "   npm run start:prod"
echo ""
echo "📊 Your app will be available at: http://localhost:3001"
echo "   (or the port specified in your .env file)"
echo ""
echo "🔧 Don't forget to:"
echo "   - Configure your reverse proxy (nginx, apache, etc.)"
echo "   - Set up SSL certificates"
echo "   - Configure firewall rules"
echo "   - Set up process monitoring (PM2, systemd, etc.)" 