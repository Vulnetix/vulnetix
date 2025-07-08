# Using the Vulnetix GitHub Action

This repository provides a GitHub Action that makes the Vulnetix CLI available in your workflows.

## Quick Start

### GitHub Action

Add the following to your workflow file (`.github/workflows/vulnetix.yml`):

```yaml
name: Vulnetix Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  security-scan:
    runs-on:# Step 6: Release Assessment with Vulnetix
echo "🎯 Running Vulnetix Release Assessment..."
docker run --rm \
  vulnetix/vulnetix:latest \
  --task release \
  --org-id "${ORG_ID}" \
  --project-name "${PROJECT_NAME}" \
  --team-name "${TEAM_NAME}" \
  --production-branch "${PRODUCTION_BRANCH}" \
  --release-branch "${RELEASE_BRANCH}" \
  --workflow-timeout 45 \
  --tags '["release", "security-scan"]'st
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Run Vulnetix scan
        uses: vulnetix/vulnetix@v1
        with:
          org-id: ${{ secrets.VULNETIX_ORG_ID }}
```

### Docker

You can run Vulnetix CLI using Docker without installing anything locally:

```bash
# Basic vulnerability scan (default task)
docker run --rm vulnetix/vulnetix:latest --org-id "123e4567-e89b-12d3-a456-426614174000"

# Release assessment task
docker run --rm vulnetix/vulnetix:latest --org-id "123e4567-e89b-12d3-a456-426614174000" --task release

# With project and team context
docker run --rm vulnetix/vulnetix:latest \
  --org-id "123e4567-e89b-12d3-a456-426614174000" \
  --project-name "my-web-app" \
  --team-name "security-team"

# Interactive mode to see help
docker run -it --rm vulnetix/vulnetix:latest --help
```

### Go Install

Install directly from source using Go (requires Go 1.21+):

```bash
# Install latest version
go install github.com/vulnetix/vulnetix@latest

# Install specific version
go install github.com/vulnetix/vulnetix@v1.2.3

# Basic vulnerability scan (default task)
vulnetix --org-id "your-org-id-here"

# Release assessment task
vulnetix --org-id "your-org-id-here" --task release

# Report generation task
vulnetix --org-id "your-org-id-here" --task report

# Triage task
vulnetix --org-id "your-org-id-here" --task triage
```

### Local Binary

```bash
# Download and run locally (basic scan)
curl -L https://github.com/vulnetix/vulnetix/releases/latest/download/vulnetix-linux-amd64 -o vulnetix
chmod +x vulnetix
./vulnetix --org-id "your-org-id-here"

# Release assessment with downloaded binary
./vulnetix --org-id "your-org-id-here" --task release --project-name "my-app"

# Upload SARIF file
./vulnetix sarif --org-id "your-org-id-here" my-scan-results.sarif
```

## Installation

Choose the installation method that works best for your environment:

### Quick Install Script

Use the installation script to automatically detect your platform:

```bash
# Install latest version (auto-detects platform)
curl -fsSL https://raw.githubusercontent.com/vulnetix/vulnetix/main/install.sh | sh

# Install to specific directory
curl -fsSL https://raw.githubusercontent.com/vulnetix/vulnetix/main/install.sh | sh -s -- --install-dir=/usr/local/bin

# Install specific version
curl -fsSL https://raw.githubusercontent.com/vulnetix/vulnetix/main/install.sh | sh -s -- --version=v1.2.3
```

### Package Managers

#### Homebrew (macOS/Linux)
```bash
# Add the tap
brew tap vulnetix/vulnetix

# Install vulnetix
brew install vulnetix

# Run
vulnetix --org-id "your-org-id-here"
```

#### Chocolatey (Windows)
```powershell
# Install chocolatey package
choco install vulnetix

# Run
vulnetix --org-id "your-org-id-here"
```

### Go Install

Install directly from source using Go (requires Go 1.21+):

```bash
# Install latest version
go install github.com/vulnetix/vulnetix@latest

# Install specific version  
go install github.com/vulnetix/vulnetix@v1.2.3

# Basic vulnerability scan (default task)
vulnetix --org-id "your-org-id-here"

# Release assessment with branch context
vulnetix --org-id "your-org-id-here" --task release --production-branch main --release-branch "release/v2.1.0"

# Report generation with project context
vulnetix --org-id "your-org-id-here" --task report --project-name "my-app" --team-name "dev-team"

# Triage task with tags
vulnetix --org-id "your-org-id-here" --task triage --tags '["critical", "frontend"]'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `org-id` | Organization ID (UUID) for Vulnetix operations | Yes | - |
| `version` | Version of Vulnetix CLI to use | No | `latest` |

## Outputs

| Output | Description |
|--------|-------------|
| `result` | Result of the Vulnetix CLI execution |

## Examples

### Basic Usage

```yaml
- name: Run Vulnetix
  uses: vulnetix/vulnetix@v1
  with:
    org-id: '123e4567-e89b-12d3-a456-426614174000'
```

### With Specific Version

```yaml
- name: Run Vulnetix
  uses: vulnetix/vulnetix@v1
  with:
    org-id: ${{ secrets.VULNETIX_ORG_ID }}
    version: 'v1.2.3'
```

### Complete Workflow Example

```yaml
name: Security and Compliance

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  vulnerability-scan:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Run Vulnetix vulnerability scan
        uses: vulnetix/vulnetix@v1
        with:
          org-id: ${{ secrets.VULNETIX_ORG_ID }}
        
      - name: Upload scan results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: vulnetix-scan-results
          path: vulnetix-results.json
          retention-days: 3
```

## Task-Based Configuration

Vulnetix supports different task types for various security workflows:

### Default Vulnerability Scanning

```yaml
- name: Vulnerability Scan
  uses: vulnetix/vulnetix@v1
  with:
    org-id: ${{ secrets.VULNETIX_ORG_ID }}
    task: scan  # Default task
    project-name: "My Web App"
    team-name: "Security Team"
    tags: '["critical", "frontend", "api"]'
```

### Release Readiness Assessment

#### GitHub Action Workflow

For comprehensive release validation across multiple security tools:

```yaml
name: Release Security Assessment

on:
  pull_request:
    branches: [ main ]

jobs:
  # Example security scanning jobs that produce artifacts
  sast-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run SAST
        run: |
          # Your SAST tool here
          echo "Running SAST scan..."
      - name: Upload SARIF
        uses: actions/upload-artifact@v4
        with:
          name: vulnetix-myrepo-${{ github.run_id }}-sast-sarif-results
          path: sarif-results.json

  sca-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate SBOM
        run: |
          # Your SBOM generation here
          echo "Generating SBOM..."
      - name: Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: vulnetix-myrepo-${{ github.run_id }}-sca-sbom-report
          path: sbom.json

  # Release readiness assessment
  release-assessment:
    runs-on: ubuntu-latest
    needs: [sast-scan, sca-scan]
    permissions:
      actions: read      # Required for accessing workflow artifacts
      contents: read     # Required for repository context
      id-token: read     # Required for artifact fetching
    steps:
      - name: Vulnetix Release Assessment
        uses: vulnetix/vulnetix@v1
        with:
          org-id: ${{ secrets.VULNETIX_ORG_ID }}
          task: release
          workflow-run-timeout: "45"
          tools: |
            - category: "SAST"
              artifact_name: "sarif-results"
              format: "SARIF"
              customer_identifier: "team-backend"
            - category: "SCA"
              artifact_name: "sbom-report"
              format: "SBOM"
              customer_identifier: "team-backend"
```

### Release Security Assessment (Bash/Shell Examples)

#### Using Docker

Complete multi-step security pipeline with Release Assessment using Docker:

```bash
#!/bin/bash
# release-assessment-docker.sh - Complete Release Security Assessment with Docker

set -e

# Configuration
ORG_ID="123e4567-e89b-12d3-a456-426614174000"
PROJECT_NAME="my-web-app"
RELEASE_BRANCH="release/v2.1.0"
PRODUCTION_BRANCH="main"
TEAM_NAME="security-team"
SCAN_RESULTS_DIR="./scan-results"

echo "🔍 Starting Release Security Assessment Pipeline..."

# Create results directory for security tool outputs
mkdir -p "${SCAN_RESULTS_DIR}"

# Step 1: Run SAST scan (example with Semgrep)
echo "📊 Running SAST scan..."
docker run --rm -v "$(pwd):/src" \
  returntocorp/semgrep:latest \
  --config=auto \
  --sarif \
  --output="/src/${SCAN_RESULTS_DIR}/sast-results.sarif" \
  /src

# Step 2: Generate SBOM (example with Syft)
echo "📋 Generating Software Bill of Materials..."
docker run --rm -v "$(pwd):/workspace" \
  anchore/syft:latest \
  dir:/workspace \
  -o spdx-json="/workspace/${SCAN_RESULTS_DIR}/sbom.spdx.json"

# Step 3: Run secrets scan (example with TruffleHog)
echo "🔐 Running secrets scan..."
docker run --rm -v "$(pwd):/repo" \
  trufflesecurity/trufflehog:latest \
  filesystem /repo \
  --json > "${SCAN_RESULTS_DIR}/secrets-results.json"

# Step 4: Run container scan (if applicable)
echo "🐳 Running container security scan..."
if [ -f "Dockerfile" ]; then
  docker run --rm -v "$(pwd):/workspace" \
    aquasec/trivy:latest \
    fs /workspace \
    --format sarif \
    --output /workspace/${SCAN_RESULTS_DIR}/container-scan.sarif
fi

# Step 5: Run dependency scan
echo "📦 Running dependency vulnerability scan..."
docker run --rm -v "$(pwd):/workspace" \
  aquasec/trivy:latest \
  fs /workspace \
  --format sarif \
  --scanners vuln \
  --output /workspace/${SCAN_RESULTS_DIR}/dependency-scan.sarif

# Step 6: Upload SARIF files to Vulnetix
echo "📤 Uploading SARIF results to Vulnetix..."
for sarif_file in "${SCAN_RESULTS_DIR}"/*.sarif; do
  if [ -f "$sarif_file" ]; then
    echo "Uploading: $sarif_file"
    docker run --rm -v "$(pwd):/workspace" \
      vulnetix/vulnetix:latest \
      sarif \
      --org-id "${ORG_ID}" \
      --project-name "${PROJECT_NAME}" \
      --team-name "${TEAM_NAME}" \
      "/workspace/$sarif_file"
  fi
done

# Step 7: Release Assessment with Vulnetix
echo "🎯 Running Vulnetix Release Assessment..."
docker run --rm \
  vulnetix/vulnetix:latest \
  --task release \
  --org-id "${ORG_ID}" \
  --project-name "${PROJECT_NAME}" \
  --team-name "${TEAM_NAME}" \
  --production-branch "${PRODUCTION_BRANCH}" \
  --release-branch "${RELEASE_BRANCH}" \
  --workflow-timeout 45 \
  --tags '["release", "security-scan"]'

echo "✅ Release Security Assessment completed!"
```

**Tool Configuration Example:**

Since Vulnetix accepts tool configurations via the `--tools` flag, you can configure multiple security tools:

```bash
# Example with tools configuration
TOOLS_CONFIG='[
  {
    "category": "SAST",
    "tool_name": "semgrep",
    "artifact_name": "sast-results",
    "format": "SARIF"
  },
  {
    "category": "SCA", 
    "tool_name": "trivy",
    "artifact_name": "dependency-scan",
    "format": "SARIF"
  },
  {
    "category": "SECRETS",
    "tool_name": "trufflehog", 
    "artifact_name": "secrets-results",
    "format": "JSON"
  }
]'

docker run --rm \
  vulnetix/vulnetix:latest \
  --task release \
  --org-id "${ORG_ID}" \
  --project-name "${PROJECT_NAME}" \
  --team-name "${TEAM_NAME}" \
  --tools "${TOOLS_CONFIG}"
```

#### Using Go Install

Complete multi-step security pipeline with Release Assessment using Go install:

```bash
#!/bin/bash
# release-assessment-go.sh - Complete Release Security Assessment with Go install

set -e

# Prerequisites check
if ! command -v vulnetix &> /dev/null; then
    echo "Installing Vulnetix CLI..."
    go install github.com/vulnetix/vulnetix@latest
fi

# Configuration
ORG_ID="123e4567-e89b-12d3-a456-426614174000"
PROJECT_NAME="my-web-app"
RELEASE_BRANCH="release/v2.1.0"
PRODUCTION_BRANCH="main"
TEAM_NAME="security-team"
SCAN_RESULTS_DIR="./scan-results"

echo "🔍 Starting Release Security Assessment Pipeline..."

# Create results directory for security tool outputs
mkdir -p "${SCAN_RESULTS_DIR}"

# Step 1: Install and run security tools
echo "📥 Installing security scanning tools..."

# Install Semgrep for SAST
if ! command -v semgrep &> /dev/null; then
    pip install semgrep
fi

# Install Syft for SBOM generation
if ! command -v syft &> /dev/null; then
    curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Install TruffleHog for secrets scanning
if ! command -v trufflehog &> /dev/null; then
    curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin
fi

# Install Trivy for container/dependency scanning
if ! command -v trivy &> /dev/null; then
    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
fi

# Step 2: Run SAST scan
echo "📊 Running SAST scan with Semgrep..."
semgrep --config=auto \
  --sarif \
  --output="${SCAN_RESULTS_DIR}/sast-results.sarif" \
  .

# Step 3: Generate SBOM
echo "📋 Generating Software Bill of Materials..."
syft . -o spdx-json="${SCAN_RESULTS_DIR}/sbom.spdx.json"

# Step 4: Run secrets scan
echo "🔐 Running secrets scan with TruffleHog..."
trufflehog filesystem . \
  --json > "${SCAN_RESULTS_DIR}/secrets-results.json"

# Step 5: Run container scan (if applicable)
echo "🐳 Running container security scan..."
if [ -f "Dockerfile" ]; then
  trivy fs . \
    --format sarif \
    --output "${SCAN_RESULTS_DIR}/container-scan.sarif"
fi

# Step 6: Run dependency scan
echo "📦 Running dependency vulnerability scan..."
trivy fs . \
  --format sarif \
  --scanners vuln \
  --output "${SCAN_RESULTS_DIR}/dependency-scan.sarif"

# Step 7: Upload SARIF files to Vulnetix
echo "📤 Uploading SARIF results to Vulnetix..."
for sarif_file in "${SCAN_RESULTS_DIR}"/*.sarif; do
  if [ -f "$sarif_file" ]; then
    echo "Uploading: $sarif_file"
    vulnetix sarif \
      --org-id "${ORG_ID}" \
      --project-name "${PROJECT_NAME}" \
      --team-name "${TEAM_NAME}" \
      "$sarif_file"
  fi
done

# Step 8: Release Assessment with Vulnetix
echo "🎯 Running Vulnetix Release Assessment..."
vulnetix \
  --task release \
  --org-id "${ORG_ID}" \
  --project-name "${PROJECT_NAME}" \
  --team-name "${TEAM_NAME}" \
  --production-branch "${PRODUCTION_BRANCH}" \
  --release-branch "${RELEASE_BRANCH}" \
  --workflow-timeout 45 \
  --tags '["release", "security-scan"]'

echo "✅ Release Security Assessment completed!"

# Step 9: Generate reports (optional)
echo "📊 Generating security reports..."
vulnetix \
  --task report \
  --org-id "${ORG_ID}" \
  --project-name "${PROJECT_NAME}" \
  --team-name "${TEAM_NAME}" \
  --tags '["release", "security-scan"]'

echo "🎉 Security assessment pipeline completed successfully!"
```

**Tool Configuration Example:**

```bash
# Example with tools configuration for release assessment
TOOLS_CONFIG='[
  {
    "category": "SAST",
    "tool_name": "semgrep",
    "artifact_name": "sast-results",
    "format": "SARIF"
  },
  {
    "category": "SCA", 
    "tool_name": "trivy",
    "artifact_name": "dependency-scan",
    "format": "SARIF"
  },
  {
    "category": "SECRETS",
    "tool_name": "trufflehog", 
    "artifact_name": "secrets-results",
    "format": "JSON"
  }
]'

vulnetix \
  --task release \
  --org-id "${ORG_ID}" \
  --project-name "${PROJECT_NAME}" \
  --team-name "${TEAM_NAME}" \
  --production-branch "${PRODUCTION_BRANCH}" \
  --release-branch "${RELEASE_BRANCH}" \
  --tools "${TOOLS_CONFIG}"
```

#### Simple Release Assessment Examples

For teams that just want to run release assessments without complex pipelines:

```bash
# Basic release assessment
vulnetix \
  --task release \
  --org-id "123e4567-e89b-12d3-a456-426614174000" \
  --project-name "my-app" \
  --production-branch "main" \
  --release-branch "release/v1.2.0"

# Release assessment with team context
vulnetix \
  --task release \
  --org-id "123e4567-e89b-12d3-a456-426614174000" \
  --project-name "frontend-app" \
  --team-name "frontend-team" \
  --production-branch "main" \
  --release-branch "release/v2.0.0" \
  --tags '["critical", "frontend", "production"]'

# Release assessment with extended timeout for large projects
vulnetix \
  --task release \
  --org-id "123e4567-e89b-12d3-a456-426614174000" \
  --project-name "monolith-app" \
  --team-name "platform-team" \
  --workflow-timeout 60 \
  --production-branch "main" \
  --release-branch "release/v3.1.0"
```
