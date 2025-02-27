SHELL := /bin/bash
.PHONY: help

help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

SEMGREP_ARGS=--use-git-ignore --metrics=off --force-color --disable-version-check --experimental --dataflow-traces --sarif --timeout=0
SEMGREP_RULES=-c p/default -c p/python -c p/php -c p/c -c p/rust -c p/apex -c p/nginx -c p/terraform -c p/csharp -c p/nextjs -c p/golang -c p/nodejs -c p/kotlin -c p/django -c p/docker -c p/kubernetes -c p/lockfiles -c p/supply-chain -c p/headless-browser -c p/expressjs -c p/cpp-audit -c p/mobsfscan -c p/ruby -c p/java -c p/javascript -c p/typescript -c p/bandit -c p/flask -c p/gosec -c p/flawfinder -c p/gitleaks -c p/eslint -c p/phpcs-security-audit -c p/react -c p/brakeman -c p/findsecbugs -c p/secrets -c p/sql-injection -c p/jwt -c p/insecure-transport -c p/command-injection -c p/security-code-scan -c p/xss

clean: ## Cleanup tmp files
	@find . -type f -name '*.DS_Store' -delete 2>/dev/null

setup: ## FOR DOCO ONLY - Run these one at a time, do not call this target directly
	nvm install --lts
	nvm use --lts
	npm install -g corepack
	rm ~/.pnp.cjs
	corepack enable
	yarn set version stable
	yarn plugin import https://raw.githubusercontent.com/spdx/yarn-plugin-spdx/main/bundles/@yarnpkg/plugin-spdx.js
	yarn plugin import https://github.com/CycloneDX/cyclonedx-node-yarn/releases/latest/download/yarn-plugin-cyclonedx.cjs

migrate: ## migrate incoming schema changes for prisma orm
	npx wrangler d1 migrations apply vulnetix --local
	npx prisma generate

plan: ## plan a migrate for schema changes in prisma orm
	npx prisma migrate diff \
		--to-schema-datamodel ./prisma/schema.prisma \
		--script --from-local-d1 >migrations/0000_plan_TMP.sql

update: submodule-update ## get app updates, migrate should be run first
	yarn up

submodule-update: ## git submodule foreach git submodule update
	git submodule sync
	git submodule foreach git submodule update
	git submodule foreach git pull
	git submodule status --recursive

install: ## install deps and build icons
	yarn install

sarif: clean ## generate SARIF from Semgrep for this project
	osv-scanner --format sarif --call-analysis=all -r . | jq >osv.sarif.json
	semgrep $(SEMGREP_ARGS) $(SEMGREP_RULES) | jq >semgrep.sarif.json

sbom: clean ## generate CycloneDX from NPM for this project
	yarn cyclonedx --spec-version 1.6 --output-format JSON --output-file vulnetix.cdx.json
	yarn spdx

deployments: ## FOR DOCO ONLY
	npx wrangler pages deployment list --project-name vulnetix

deploy: ## FOR DOCO ONLY
	npx wrangler pages deployment create ./dist --project-name vulnetix --branch staging --upload-source-maps=true

run: ## FOR DOCO ONLY - Run these one at a time, do not call this target directly
	lsof -i tcp:8788
	npm run preview

git-staging:
	[[ -z "$(shell git status -s)" ]] || git stash save "changes for staging"
	git submodule foreach '[[ -z "$(shell git status -s)" ]] || git stash save "changes for staging"'
	git checkout -f main
	git branch -D staging
	git fetch -a
	git submodule foreach git fetch -a
	git submodule foreach git pull
	git pull
	git checkout -b staging main
	git push --set-upstream origin staging
	git submodule sync
	git submodule foreach git submodule update
	git stash pop || true
	git submodule foreach 'git stash pop || true'
	git status

_helpers: ## FOR DOCO ONLY
	npx wrangler d1 execute vulnetix --local --file ./migrations/0001_init.sql
	npx wrangler d1 execute vulnetix --remote --command "SELECT * FROM Member;"
	npx wrangler d1 execute vulnetix --local --command 'PRAGMA table_list;'
	npx wrangler d1 execute vulnetix --local --command 'PRAGMA table_info("Member");'
	npx wrangler d1 execute vulnetix --remote --command 'INSERT INTO MemberGroups (memberUuid, groupUuid) VALUES ("a5c8611d-81e9-4cd0-8b16-f3e278064c3e", "8ac52122-b9ae-40fb-b4c6-7c83238ae8d6");'
	npx prisma migrate diff \
	--from-empty \
	--to-schema-datamodel ./prisma/schema.prisma \
	--script \
	--output migrations/0001_init.sql
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "TestingProcedureResult";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "RequirementScope";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "RequirementResult";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "TestingProcedure";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "Requirement";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "ReportingInstructions";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "ReportType";'
	npx wrangler d1 execute vulnetix --local --command 'DELETE FROM "Report";'
