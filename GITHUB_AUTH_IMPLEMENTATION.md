# GitHub Authentication Implementation

This document describes the comprehensive GitHub authentication system that supports all the required use cases.

## Overview

The implementation provides four distinct GitHub authentication flows:

1. **GitHub App Installation** - For integrating repositories and accessing GitHub API
2. **GitHub App OAuth** - For connecting user accounts to installed GitHub Apps
3. **GitHub SSO Login** - For authenticating existing users via GitHub SSO
4. **GitHub SSO Signup** - For creating new accounts via GitHub SSO

## Key Components

### Authentication Providers (`shared/auth.ts`)

- **GitHubSSOAuthProvider**: Handles GitHub SSO authentication (separate from GitHub App)
- **GoogleSSOAuthProvider**: Handles Google SSO authentication
- **PasswordAuthProvider**: Handles traditional email/password authentication
- **AuthManager**: Coordinates all authentication providers

### Database Models

- **GitHubApp**: Stores GitHub App installation information
- **GitHubSSOConfig**: Stores GitHub SSO user configurations
- **GoogleSSOConfig**: Stores Google SSO user configurations
- **AuthProvider**: Stores available authentication provider configurations

### API Endpoints

#### GitHub App Management
- `GET /api/github/apps` - List GitHub App installations for org
- `DELETE /api/github/apps` - Remove GitHub App installation
- `GET /api/github/install/[installation_id]` - Setup GitHub App installation
- `GET /api/github/app-info` - Get GitHub App installation URL
- `POST /api/github/webhook` - Handle GitHub App webhooks

#### GitHub SSO Authentication
- `GET /api/github/sso/login/[code]` - GitHub SSO login callback
- `GET /api/github/sso/signup/[code]` - GitHub SSO signup callback
- `GET /api/github/sso` - List GitHub SSO configurations (admin)
- `PATCH /api/github/sso` - Block/unblock GitHub SSO users (admin)
- `DELETE /api/github/sso` - Delete GitHub SSO configuration (admin)

#### GitHub App OAuth (Legacy)
- `GET /api/github/oauth/[code]` - GitHub App OAuth callback
- `GET /api/login/github/[code]` - Legacy GitHub login (updated)

### Frontend Components

#### Authentication Pages
- `GitHubSSOLogin.vue` - GitHub SSO login page
- `GitHubSSOSignup.vue` - GitHub SSO signup page
- `Security.vue` - Updated to manage GitHub SSO configurations

## Authentication Flows

### 1. GitHub App Installation (New Organization Setup)

```
User -> GitHub App Install URL -> GitHub -> Installation Callback -> Vulnetix
```

1. User clicks GitHub App installation link
2. GitHub prompts for organization/account selection
3. User authorizes the app for their GitHub organization
4. GitHub redirects to installation callback
5. Vulnetix creates GitHubApp record for the organization
6. Repositories become available for scanning

**Unique Organization Handling**: Each GitHub App installation can only be connected to one Vulnetix organization. If attempted on multiple orgs, only the first succeeds.

### 2. GitHub SSO Signup (New User/Organization)

```
User -> GitHub SSO URL -> GitHub -> OAuth Callback -> Vulnetix -> New Org/Member
```

1. User clicks GitHub SSO signup link
2. GitHub OAuth flow (scope: `user:email`)
3. Vulnetix receives authorization code
4. Exchange for access token and get user info
5. Check if user/org exists by email domain
6. Create new org if needed (unique name handling)
7. Create member account with random password (SSO only)
8. Create GitHubSSOConfig record
9. Generate session and redirect to dashboard

**Unique Organization Names**: Automatically appends numbers if organization name conflicts exist.

### 3. GitHub SSO Login (Existing User)

```
User -> GitHub SSO URL -> GitHub -> OAuth Callback -> Vulnetix -> Dashboard
```

1. User clicks GitHub SSO login link
2. GitHub OAuth flow
3. Vulnetix validates existing GitHubSSOConfig
4. Check if config is blocked
5. Update last used timestamp
6. Generate session and redirect to dashboard

### 4. GitHub App OAuth Integration (Post-Login)

```
Logged User -> GitHub OAuth URL -> GitHub -> OAuth Callback -> Repository Access
```

1. Already logged-in user wants to connect GitHub repositories
2. GitHub OAuth flow with GitHub App credentials
3. Creates GitHubOAuth record linked to member
4. Updates integration configuration
5. Repositories become available for the user's organization

## Security Features

### Organization Isolation
- Each GitHub App installation belongs to exactly one Vulnetix organization
- GitHub SSO configurations are organization-scoped
- Cross-organization access is prevented

### User Management
- Administrators can block/unblock GitHub SSO users
- Session revocation for blocked users
- Audit trail with last used timestamps

### Secure Configuration
- Separate OAuth clients for GitHub App vs GitHub SSO
- Webhook signature verification
- Token expiration and refresh handling

## Environment Variables Required

```
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_CLIENT_ID=your_github_app_client_id
GITHUB_APP_CLIENT_SECRET=your_github_app_client_secret
GITHUB_SSO_CLIENT_ID=your_github_sso_client_id
GITHUB_SSO_CLIENT_SECRET=your_github_sso_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
APP_PRIVATE_KEY=your_github_app_private_key
```

## Migration Required

Run the following migration to set up authentication providers:

```sql
-- Execute migrations/0040_github_sso_auth.sql
```

## Frontend Integration

### Login/Signup Forms

Add GitHub SSO buttons with appropriate OAuth URLs:

**Login**: `https://github.com/login/oauth/authorize?client_id=${GITHUB_SSO_CLIENT_ID}&redirect_uri=${origin}/api/github/sso/login&scope=user:email`

**Signup**: `https://github.com/login/oauth/authorize?client_id=${GITHUB_SSO_CLIENT_ID}&redirect_uri=${origin}/api/github/sso/signup&scope=user:email`

### GitHub App Installation

**Install URL**: Available via `/api/github/app-info` endpoint

### Organization Settings

The Security.vue page now includes:
- GitHub SSO user management
- Block/unblock functionality  
- Configuration deletion
- Status monitoring

## Testing Scenarios

1. **New Organization Signup**: Create GitHub SSO account -> New org created
2. **Existing Domain Signup**: Use company email -> Joins existing org
3. **GitHub App Installation**: Install app -> Repositories accessible
4. **Multiple Installations**: Install app in multiple GitHub orgs -> Works independently
5. **SSO Management**: Block user -> Cannot login, sessions invalidated
6. **Cross-Org Prevention**: Try to connect same GitHub App to multiple Vulnetix orgs -> Blocked

This implementation fully supports all the specified GitHub authentication requirements while maintaining security and preventing conflicts between different authentication methods.
