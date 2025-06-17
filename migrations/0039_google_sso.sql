-- Add Google SSO authentication support

-- Add authentication provider tracking to Session table
ALTER TABLE Session ADD COLUMN authProvider TEXT DEFAULT 'password';
ALTER TABLE Session ADD COLUMN authProviderData TEXT;

-- Add Google SSO enforcement to Org table
ALTER TABLE Org ADD COLUMN enforceGoogleSSO INTEGER NOT NULL DEFAULT 0;

-- Create GoogleSSOConfig table for Google OAuth configurations
CREATE TABLE "GitHubSSOConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" TEXT NOT NULL,
    "memberUuid" TEXT,
    "githubId" INTEGER NOT NULL,
    "login" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "created" INTEGER NOT NULL,
    "lastUsed" INTEGER,
    "blocked" INTEGER NOT NULL DEFAULT 0
);

-- Create AuthProvider table for managing different authentication providers
CREATE TABLE "AuthProvider" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT UNIQUE NOT NULL,
    "displayName" TEXT NOT NULL,
    "enabled" INTEGER NOT NULL DEFAULT 1,
    "config" TEXT
);

-- Insert default auth providers
INSERT INTO AuthProvider (name, displayName, enabled, config) VALUES 
    ('password', 'Email & Password', 1, '{"type": "password"}'),
    ('google', 'Google SSO', 1, '{"type": "oauth2", "provider": "google"}'),
    ('github-sso', 'GitHub SSO', 1, '{"type": "oauth2", "provider": "github"}'),
    ('github-app', 'GitHub App OAuth', 1, '{"type": "oauth2", "provider": "github", "scope": "app"}');

-- Create indexes for performance
CREATE INDEX GoogleSSOConfig_orgId_memberUuid_idx ON GoogleSSOConfig(orgId, memberUuid);
CREATE INDEX GoogleSSOConfig_orgId_idx ON GoogleSSOConfig(orgId);
CREATE INDEX GoogleSSOConfig_memberUuid_idx ON GoogleSSOConfig(memberUuid);
CREATE INDEX GoogleSSOConfig_email_idx ON GoogleSSOConfig(email);
CREATE INDEX GoogleSSOConfig_googleId_idx ON GoogleSSOConfig(googleId);
CREATE INDEX Session_authProvider_idx ON Session(authProvider);
