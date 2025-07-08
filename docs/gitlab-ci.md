# Vulnetix GitLab CI Reference

Comprehensive guide for integrating Vulnetix CLI in GitLab CI/CD pipelines.

## Quick Start

```yaml
# .gitlab-ci.yml
stages:
  - security

vulnetix-security-scan:
  stage: security
  image: vulnetix/vulnetix:latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
  variables:
    VULNETIX_ORG_ID: $VULNETIX_ORG_ID
```

## Installation Methods

### Using Docker Image

```yaml
# .gitlab-ci.yml
vulnetix-scan:
  image: vulnetix/vulnetix:latest
  stage: security
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
```

### Using Go Install

```yaml
vulnetix-scan:
  image: golang:1.21
  stage: security
  before_script:
    - go install github.com/vulnetix/vulnetix@latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
```

### Using Binary Download

```yaml
vulnetix-scan:
  image: alpine:latest
  stage: security
  before_script:
    - apk add --no-cache curl
    - curl -L https://github.com/vulnetix/vulnetix/releases/latest/download/vulnetix-linux-amd64 -o vulnetix
    - chmod +x vulnetix
  script:
    - ./vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
```

## Configuration

### Variables

Configure in GitLab UI: Settings > CI/CD > Variables

| Variable | Description | Protected | Masked |
|----------|-------------|-----------|---------|
| `VULNETIX_ORG_ID` | Organization ID (UUID) | ✅ | ✅ |
| `VULNETIX_API_TOKEN` | API token for authentication | ✅ | ✅ |
| `VULNETIX_API_URL` | Custom API endpoint | ❌ | ❌ |

### Environment-Specific Variables

```yaml
variables:
  VULNETIX_ORG_ID: $VULNETIX_ORG_ID
  VULNETIX_LOG_LEVEL: "info"
  
# Development environment
vulnetix-dev:
  stage: security
  environment: development
  variables:
    VULNETIX_TAGS: "development,ci"
  script:
    - vulnetix --task scan --tags "$VULNETIX_TAGS"
  only:
    - develop

# Production environment  
vulnetix-prod:
  stage: security
  environment: production
  variables:
    VULNETIX_TAGS: "production,release"
  script:
    - vulnetix --task scan --tags "$VULNETIX_TAGS"
  only:
    - main
```

## Usage Examples

### Basic Security Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - security
  - deploy

variables:
  VULNETIX_ORG_ID: $VULNETIX_ORG_ID
  PROJECT_NAME: $CI_PROJECT_NAME
  TEAM_NAME: "DevSecOps"

# Security scanning stage
security-scan:
  stage: security
  image: vulnetix/vulnetix:latest
  script:
    - vulnetix --task scan 
        --project-name "$PROJECT_NAME"
        --team-name "$TEAM_NAME"
        --build-id "$CI_PIPELINE_ID"
  artifacts:
    reports:
      sast: vulnetix-output/sast.json
    paths:
      - vulnetix-output/
    expire_in: 7 days
  only:
    - main
    - merge_requests
```

### Comprehensive Release Assessment

```yaml
stages:
  - build
  - security-scans
  - security-assessment
  - deploy

variables:
  VULNETIX_ORG_ID: $VULNETIX_ORG_ID
  REPORTS_DIR: "security-reports"

# SAST scanning
sast-scan:
  stage: security-scans
  image: returntocorp/semgrep
  script:
    - mkdir -p $REPORTS_DIR
    - semgrep --config=auto --sarif --output=$REPORTS_DIR/sast-semgrep.sarif .
  artifacts:
    paths:
      - $REPORTS_DIR/sast-semgrep.sarif
    expire_in: 1 day

# SCA scanning
sca-scan:
  stage: security-scans
  image: anchore/syft
  script:
    - mkdir -p $REPORTS_DIR
    - syft dir:. -o spdx-json=$REPORTS_DIR/sbom.json
  artifacts:
    paths:
      - $REPORTS_DIR/sbom.json
    expire_in: 1 day

# Secrets scanning
secrets-scan:
  stage: security-scans
  image: alpine/git
  before_script:
    - apk add --no-cache curl tar
    - curl -sSfL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.18.0_linux_x64.tar.gz | tar -xz
  script:
    - mkdir -p $REPORTS_DIR
    - ./gitleaks detect --source=. --report-format=sarif --report-path=$REPORTS_DIR/secrets-gitleaks.sarif
  artifacts:
    paths:
      - $REPORTS_DIR/secrets-gitleaks.sarif
    expire_in: 1 day

# Container scanning (if Dockerfile exists)
container-scan:
  stage: security-scans
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --no-cache curl
    - curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
  script:
    - mkdir -p $REPORTS_DIR
    - |
      if [ -f "Dockerfile" ]; then
        docker build -t $CI_PROJECT_NAME:$CI_COMMIT_SHA .
        grype $CI_PROJECT_NAME:$CI_COMMIT_SHA -o sarif=$REPORTS_DIR/container-grype.sarif
      else
        echo "No Dockerfile found, skipping container scan"
        touch $REPORTS_DIR/container-grype.sarif
      fi
  artifacts:
    paths:
      - $REPORTS_DIR/container-grype.sarif
    expire_in: 1 day
  only:
    changes:
      - Dockerfile
      - docker-compose.yml

# Vulnetix release assessment
vulnetix-assessment:
  stage: security-assessment
  image: vulnetix/vulnetix:latest
  dependencies:
    - sast-scan
    - sca-scan
    - secrets-scan
    - container-scan
  script:
    - |
      vulnetix --task release \
        --production-branch "main" \
        --release-branch "$CI_COMMIT_REF_NAME" \
        --project-name "$CI_PROJECT_NAME" \
        --team-name "Security Engineering" \
        --tools '[
          {
            "category": "SAST",
            "tool_name": "semgrep",
            "artifact_name": "./'$REPORTS_DIR'/sast-semgrep.sarif",
            "format": "SARIF"
          },
          {
            "category": "SCA",
            "tool_name": "sca-tool",
            "artifact_name": "./'$REPORTS_DIR'/sbom.json",
            "format": "JSON"
          },
          {
            "category": "SECRETS",
            "tool_name": "gitleaks",
            "artifact_name": "./'$REPORTS_DIR'/secrets-gitleaks.sarif",
            "format": "SARIF"
          },
          {
            "category": "CONTAINER",
            "tool_name": "grype",
            "artifact_name": "./'$REPORTS_DIR'/container-grype.sarif",
            "format": "SARIF"
          }
        ]'
  artifacts:
    reports:
      sast: vulnetix-output/aggregated-sast.json
    paths:
      - vulnetix-output/
      - $REPORTS_DIR/
    expire_in: 30 days
  only:
    - merge_requests
    - main
```

### Language-Specific Pipelines

#### Go Projects

```yaml
# Go-specific security pipeline
go-security-scan:
  stage: security
  image: golang:1.21
  before_script:
    - go install github.com/vulnetix/vulnetix@latest
    - go install golang.org/x/vuln/cmd/govulncheck@latest
    - go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest
  script:
    - mkdir -p security-reports
    
    # Go vulnerability check
    - govulncheck -json ./... > security-reports/govulncheck.json
    
    # Go security analysis
    - gosec -fmt sarif -out security-reports/gosec.sarif ./...
    
    # Generate Go module SBOM
    - go list -json -deps ./... > security-reports/go-deps.json
    
    # Run Vulnetix assessment
    - vulnetix --task release 
        --production-branch "main"
        --release-branch "$CI_COMMIT_REF_NAME"
        --tools '[
          {
            "category": "SCA",
            "tool_name": "govulncheck",
            "artifact_name": "./security-reports/govulncheck.json",
            "format": "JSON"
          },
          {
            "category": "SAST",
            "tool_name": "gosec",
            "artifact_name": "./security-reports/gosec.sarif",
            "format": "SARIF"
          }
        ]'
  artifacts:
    paths:
      - security-reports/
    expire_in: 7 days
  only:
    changes:
      - "*.go"
      - "go.mod"
      - "go.sum"
```

#### Node.js Projects

```yaml
nodejs-security-scan:
  stage: security
  image: node:18
  before_script:
    - npm install -g @vulnetix/cli
    - npm install -g audit-ci
  script:
    - mkdir -p security-reports
    
    # NPM audit
    - npm audit --audit-level=moderate --json > security-reports/npm-audit.json || true
    
    # Generate package lock analysis
    - npm list --json --all > security-reports/npm-deps.json
    
    # Run Vulnetix assessment
    - vulnetix --task scan 
        --project-name "$CI_PROJECT_NAME"
        --team-name "Frontend Team"
  artifacts:
    paths:
      - security-reports/
    expire_in: 7 days
  only:
    changes:
      - "package.json"
      - "package-lock.json"
      - "*.js"
      - "*.ts"
```

#### Python Projects

```yaml
python-security-scan:
  stage: security
  image: python:3.9
  before_script:
    - pip install vulnetix-cli safety bandit
  script:
    - mkdir -p security-reports
    
    # Python safety check
    - safety check --json --output security-reports/safety.json || true
    
    # Bandit SAST
    - bandit -r . -f sarif -o security-reports/bandit.sarif || true
    
    # Generate requirements analysis
    - pip freeze > security-reports/requirements-freeze.txt
    
    # Run Vulnetix assessment
    - vulnetix --task scan 
        --project-name "$CI_PROJECT_NAME"
        --team-name "Backend Team"
  artifacts:
    paths:
      - security-reports/
    expire_in: 7 days
  only:
    changes:
      - "*.py"
      - "requirements.txt"
      - "setup.py"
      - "pyproject.toml"
```

## Edge Cases & Advanced Configuration

### Corporate Proxy Support

```yaml
variables:
  HTTP_PROXY: "http://proxy.company.com:8080"
  HTTPS_PROXY: "http://proxy.company.com:8080"
  NO_PROXY: "localhost,127.0.0.1,.company.com"
  
vulnetix-proxy-scan:
  stage: security
  image: vulnetix/vulnetix:latest
  before_script:
    # Configure proxy for package managers
    - export http_proxy=$HTTP_PROXY
    - export https_proxy=$HTTPS_PROXY
    - export no_proxy=$NO_PROXY
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
```

### Self-Hosted GitLab Runners

```yaml
vulnetix-self-hosted:
  stage: security
  tags:
    - security-scanner
    - docker
  image: vulnetix/vulnetix:latest
  before_script:
    # Verify runner environment
    - docker --version
    - df -h  # Check disk space
    - curl -I https://app.vulnetix.com/api/  # Test connectivity
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
  after_script:
    # Cleanup
    - docker system prune -f
    - rm -rf vulnetix-output/cache/
```

### Air-Gapped Environments

```yaml
vulnetix-airgapped:
  stage: security
  image: registry.company.com/vulnetix/vulnetix:latest
  variables:
    VULNETIX_API_URL: "https://vulnetix.company.com/api"
    VULNETIX_REGISTRY_URL: "https://registry.company.com"
  before_script:
    # Use internal certificate authority
    - cp /etc/ssl/company-ca.crt /usr/local/share/ca-certificates/
    - update-ca-certificates
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan --offline-mode
```

### Multi-Environment Deployment

```yaml
# Development environment
.vulnetix-dev: &vulnetix-dev
  stage: security
  variables:
    VULNETIX_TAGS: "development,ci"
    VULNETIX_PRIORITY: "medium"
  script:
    - vulnetix --task scan --tags "$VULNETIX_TAGS" --priority "$VULNETIX_PRIORITY"
  only:
    - develop
    - feature/*

# Staging environment  
.vulnetix-staging: &vulnetix-staging
  stage: security
  variables:
    VULNETIX_TAGS: "staging,pre-production"
    VULNETIX_PRIORITY: "high"
  script:
    - vulnetix --task release --tags "$VULNETIX_TAGS" --priority "$VULNETIX_PRIORITY"
  only:
    - staging

# Production environment
.vulnetix-prod: &vulnetix-prod
  stage: security
  variables:
    VULNETIX_TAGS: "production,critical"
    VULNETIX_PRIORITY: "critical"
  script:
    - vulnetix --task release --tags "$VULNETIX_TAGS" --priority "$VULNETIX_PRIORITY"
  only:
    - main

vulnetix-dev:
  <<: *vulnetix-dev
  image: vulnetix/vulnetix:latest

vulnetix-staging:
  <<: *vulnetix-staging
  image: vulnetix/vulnetix:latest

vulnetix-prod:
  <<: *vulnetix-prod
  image: vulnetix/vulnetix:latest
```

### Parallel Security Scans

```yaml
# Parallel execution for faster scans
.parallel-security: &parallel-security
  stage: security
  parallel:
    matrix:
      - SCAN_TYPE: [sast, sca, secrets, container]

parallel-security-scan:
  <<: *parallel-security
  image: alpine:latest
  before_script:
    - apk add --no-cache curl docker git
  script:
    - mkdir -p security-reports
    - |
      case $SCAN_TYPE in
        sast)
          # SAST scanning logic
          curl -sSfL https://github.com/semgrep/semgrep/releases/latest/download/semgrep-linux-x86_64 -o semgrep
          chmod +x semgrep
          ./semgrep --config=auto --sarif --output=security-reports/sast.sarif .
          ;;
        sca)
          # SCA scanning logic  
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
          syft dir:. -o spdx-json=security-reports/sbom.json
          ;;
        secrets)
          # Secrets scanning logic
          curl -sSfL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.18.0_linux_x64.tar.gz | tar -xz
          ./gitleaks detect --source=. --report-format=sarif --report-path=security-reports/secrets.sarif
          ;;
        container)
          # Container scanning logic
          if [ -f "Dockerfile" ]; then
            docker build -t scan-target .
            curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
            grype scan-target -o sarif=security-reports/container.sarif
          fi
          ;;
      esac
  artifacts:
    paths:
      - security-reports/
    expire_in: 1 hour
```

### Custom Security Rules

```yaml
vulnetix-custom-rules:
  stage: security
  image: vulnetix/vulnetix:latest
  before_script:
    # Download custom security rules
    - curl -sSfL "$CUSTOM_RULES_URL" -o custom-rules.yaml
  script:
    - vulnetix --task scan 
        --config-file custom-rules.yaml
        --custom-rules-enabled
        --severity-threshold high
  artifacts:
    when: always
    paths:
      - vulnetix-output/
    reports:
      sast: vulnetix-output/custom-sast.json
```

## Integration with GitLab Features

### Security Dashboard Integration

```yaml
vulnetix-security-dashboard:
  stage: security
  image: vulnetix/vulnetix:latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan --project-name "$CI_PROJECT_NAME"
  artifacts:
    reports:
      sast: vulnetix-output/gl-sast-report.json
      dependency_scanning: vulnetix-output/gl-dependency-scanning-report.json
      container_scanning: vulnetix-output/gl-container-scanning-report.json
    expire_in: 1 week
```

### Merge Request Integration

```yaml
vulnetix-mr-security:
  stage: security
  image: vulnetix/vulnetix:latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
    - |
      # Comment on MR with results
      if [ -n "$CI_MERGE_REQUEST_IID" ]; then
        SCAN_RESULTS=$(cat vulnetix-output/summary.json)
        curl -X POST \
          -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"body\": \"## Security Scan Results\n\`\`\`json\n$SCAN_RESULTS\n\`\`\`\"}" \
          "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
      fi
  only:
    - merge_requests
```

### GitLab Pages Integration

```yaml
vulnetix-pages:
  stage: deploy
  image: vulnetix/vulnetix:latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task report --format html
    - mkdir public
    - cp -r vulnetix-output/reports/* public/
  artifacts:
    paths:
      - public
  only:
    - main
```

## Troubleshooting

### Common Issues

#### Image Pull Issues

```yaml
# Issue: Cannot pull vulnetix/vulnetix image
# Solution: Use alternative registry or build custom image

vulnetix-custom-image:
  stage: security
  image: golang:1.21
  before_script:
    - go install github.com/vulnetix/vulnetix@latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
```

#### Variable Not Set

```yaml
# Issue: VULNETIX_ORG_ID not set
# Solution: Add default and validation

vulnetix-with-validation:
  stage: security
  image: vulnetix/vulnetix:latest
  before_script:
    - |
      if [ -z "$VULNETIX_ORG_ID" ]; then
        echo "ERROR: VULNETIX_ORG_ID not set"
        echo "Please set this variable in GitLab CI/CD settings"
        exit 1
      fi
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
```

#### Network Connectivity

```yaml
# Issue: Cannot connect to Vulnetix API
# Solution: Debug network connectivity

vulnetix-debug-network:
  stage: security
  image: vulnetix/vulnetix:latest
  before_script:
    - apk add --no-cache curl nmap-ncat
    - echo "Testing connectivity..."
    - curl -I https://app.vulnetix.com/api/ || echo "API unreachable"
    - nslookup app.vulnetix.com || echo "DNS resolution failed"
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan --verbose
```

#### Artifact Upload Failures

```yaml
# Issue: Artifacts not uploading
# Solution: Debug and fix paths

vulnetix-debug-artifacts:
  stage: security
  image: vulnetix/vulnetix:latest
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan
    - ls -la vulnetix-output/
    - find . -name "*.sarif" -o -name "*.json" | head -20
  artifacts:
    when: always  # Upload even on failure
    paths:
      - vulnetix-output/
      - "**/*.sarif"
      - "**/*.json"
    expire_in: 1 day
```

### Performance Issues

#### Large Repository Optimization

```yaml
vulnetix-optimized:
  stage: security
  image: vulnetix/vulnetix:latest
  variables:
    GIT_DEPTH: 10  # Shallow clone
    GIT_STRATEGY: clone
  cache:
    key: vulnetix-cache-$CI_PROJECT_ID
    paths:
      - .vulnetix-cache/
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan --cache-dir .vulnetix-cache/
```

#### Parallel Job Optimization

```yaml
vulnetix-parallel-opt:
  stage: security
  image: vulnetix/vulnetix:latest
  parallel: 3
  script:
    - vulnetix --org-id "$VULNETIX_ORG_ID" --task scan --parallel-jobs $CI_NODE_TOTAL --node-index $CI_NODE_INDEX
```

For more examples and advanced configurations, see the [main documentation](../USAGE.md) and other [reference guides](./README.md).
