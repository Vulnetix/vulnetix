# Google SSO Setup Guide

This guide explains how to set up and configure Google Single Sign-On (SSO) for Vulnetix.

## Prerequisites

1. A Google Cloud Platform (GCP) project
2. OAuth 2.0 credentials configured in GCP Console
3. Environment variables configured in Cloudflare Workers

## Google Cloud Platform Setup

### 1. Create a GCP Project (if you don't have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

### 2. Enable Google+ API

1. Navigate to **APIs & Services** > **Library**
2. Search for "Google+ API" or "People API"
3. Enable the API for your project

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Configure the consent screen if prompted
4. Select **Web application** as the application type
5. Add authorized redirect URIs:
   - For development: `http://localhost:5173/google-login` and `http://localhost:5173/google-signup`
   - For production: `https://yourdomain.com/google-login` and `https://yourdomain.com/google-signup`
6. Save the Client ID and Client Secret

## Environment Variables Setup

Add the following environment variables to your Cloudflare Workers environment:

### Development (.dev.vars)
```bash
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### Production (Cloudflare Dashboard)
1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your Vulnetix worker
3. Go to Settings > Environment Variables
4. Add:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret

## Database Setup

The Google SSO feature requires new database tables. Run the migration:

```bash
# Apply the migration
npm run db:migrate

# Or if using direct SQL
sqlite3 vulnetix.db < migrations/0039_google_sso.sql
```

## How Google SSO Works

### User Flow

1. **Registration**: Users can sign up using Google SSO from the Register page
2. **Login**: Users can log in using Google SSO from the Login page
3. **Account Linking**: Google accounts are automatically linked to Vulnetix user accounts

### Administrator Features

Administrators can manage Google SSO through the Security settings:

1. **View Google SSO Configurations**: See all Google accounts linked to the organization
2. **Block/Unblock Users**: Prevent or allow users from using Google SSO
3. **Revoke Sessions**: Force logout of all sessions for a specific Google account
4. **Delete Configurations**: Permanently remove Google SSO configurations
5. **Organization Enforcement**: Require all users in an organization to use Google SSO

### Technical Details

#### Authentication Flow

1. User clicks "Continue with Google" button
2. Redirected to Google OAuth consent screen
3. After consent, Google redirects back with authorization code
4. Backend exchanges code for access token and user information
5. User account is created/linked and session is established

#### Data Storage

- **GoogleSSOConfig**: Stores Google account information and configuration
- **Session**: Extended to store auth provider information
- **Org**: Can enforce Google SSO for all members

#### Security Features

- Session tokens are stored securely
- Google SSO can be enforced at organization level
- Administrators can block individual users
- All sessions can be revoked for security purposes

## API Endpoints

### Authentication
- `POST /api/login/google/[code]` - Login with Google OAuth code
- `POST /api/signup/google/[code]` - Register with Google OAuth code

### Administration
- `GET /api/google/sso/[configId]` - Get Google SSO configuration
- `POST /api/google/sso/[configId]/block` - Block user
- `POST /api/google/sso/[configId]/unblock` - Unblock user
- `POST /api/google/sso/[configId]/revoke-sessions` - Revoke all sessions
- `DELETE /api/google/sso/[configId]` - Delete configuration

### Configuration
- `GET /api/check/[email]` - Check if Google SSO is available/required
- `GET /api/security/configs` - Get security configurations including Google SSO
- `POST /api/org/settings` - Update organization settings including Google SSO enforcement

## Frontend Integration

### Login and Registration Pages

Both Login.vue and Register.vue include Google SSO buttons with the same styling as GitHub buttons for UI consistency.

### Security Management

The Security.vue page includes a comprehensive Google SSO management interface for administrators.

### Callback Pages

- **GoogleLogin.vue**: Handles the OAuth callback for login flow
- **GoogleSignup.vue**: Handles the OAuth callback for registration flow

## Troubleshooting

### Common Issues

1. **"OAuth Error: Invalid redirect URI"**
   - Ensure the redirect URIs in GCP Console match your application URLs exactly
   - Check both development and production URLs

2. **"Client ID not found"**
   - Verify `GOOGLE_CLIENT_ID` environment variable is set correctly
   - Ensure the GCP project has OAuth credentials created

3. **"Access denied"**
   - Check if the user has been blocked by an administrator
   - Verify organization Google SSO enforcement settings

4. **"Database error"**
   - Ensure the migration has been applied
   - Check database connection and permissions

### Debugging

Enable debug logging by setting `LOG_LEVEL=debug` in your environment variables to see detailed OAuth flow information.

## Security Considerations

1. **Client Secret Protection**: Never expose the Google Client Secret in frontend code
2. **HTTPS in Production**: Always use HTTPS for OAuth redirects in production
3. **Session Management**: Regularly audit and revoke unnecessary sessions
4. **Organization Policies**: Use Google SSO enforcement for enhanced security
5. **Regular Updates**: Keep OAuth configurations and scopes up to date

## Testing

### Development Testing

1. Set up OAuth credentials for localhost
2. Configure development environment variables
3. Test login and registration flows
4. Verify administrator features work correctly

### Production Testing

1. Configure production OAuth redirect URIs
2. Test with real Google accounts
3. Verify all administrative functions
4. Test organization enforcement policies
