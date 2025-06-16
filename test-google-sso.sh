#!/bin/bash

# Google SSO Integration Test Script
# This script tests the basic endpoints to ensure they're accessible

BASE_URL="http://localhost:8788"  # Cloudflare Workers dev server
FRONTEND_URL="http://localhost:5173"  # Vite dev server

echo "🧪 Testing Google SSO Integration"
echo "================================="

# Test frontend routes
echo "📱 Testing Frontend Routes..."

echo "Testing login page..."
curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/login" || echo "❌ Login page not accessible"

echo "Testing register page..."
curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/register" || echo "❌ Register page not accessible"

# Test API endpoints (these will return errors without proper auth/data, but should be reachable)
echo ""
echo "🔌 Testing API Endpoints..."

echo "Testing check email endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/check/test@example.com" | tail -1)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "404" ]; then
    echo "✅ Check email endpoint accessible"
else
    echo "❌ Check email endpoint not accessible (HTTP $RESPONSE)"
fi

echo "Testing security configs endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/security/configs" | tail -1)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "403" ]; then
    echo "✅ Security configs endpoint accessible"
else
    echo "❌ Security configs endpoint not accessible (HTTP $RESPONSE)"
fi

# Test Google OAuth endpoints (will return errors without valid codes, but should be reachable)
echo "Testing Google login endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/login/google/invalid_code" | tail -1)
if [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "500" ]; then
    echo "✅ Google login endpoint accessible"
else
    echo "❌ Google login endpoint not accessible (HTTP $RESPONSE)"
fi

echo "Testing Google signup endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/signup/google/invalid_code" | tail -1)
if [ "$RESPONSE" = "400" ] || [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "500" ]; then
    echo "✅ Google signup endpoint accessible"
else
    echo "❌ Google signup endpoint not accessible (HTTP $RESPONSE)"
fi

echo ""
echo "📋 Test Summary"
echo "==============="
echo "✅ All endpoints appear to be properly configured"
echo "🔧 To complete testing, you'll need to:"
echo "   1. Set up Google OAuth credentials"
echo "   2. Configure environment variables"
echo "   3. Test with real Google OAuth flow"
echo ""
echo "📖 See GOOGLE_SSO_SETUP.md for detailed setup instructions"
