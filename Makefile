SHELL := /bin/bash
.PHONY: help

help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

SEMGREP_ARGS=--verbose --use-git-ignore --metrics=off --force-color --disable-version-check --experimental --dataflow-traces --sarif --timeout=0
SEMGREP_RULES=-c p/default -c p/python -c p/php -c p/c -c p/rust -c p/apex -c p/nginx -c p/terraform -c p/csharp -c p/nextjs -c p/golang -c p/nodejs -c p/kotlin -c p/django -c p/docker -c p/kubernetes -c p/lockfiles -c p/supply-chain -c p/headless-browser -c p/expressjs -c p/cpp-audit -c p/mobsfscan -c p/ruby -c p/java -c p/javascript -c p/typescript -c p/bandit -c p/flask -c p/gosec -c p/flawfinder -c p/gitleaks -c p/eslint -c p/phpcs-security-audit -c p/react -c p/brakeman -c p/findsecbugs -c p/secrets -c p/sql-injection -c p/jwt -c p/insecure-transport -c p/command-injection -c p/security-code-scan -c p/xss
DATABASE_URL="file:./vulnetix.db"

clean: ## Cleanup tmp files
	@find . -type f -name '*.DS_Store' -delete 2>/dev/null

setup: ## FOR DOCO ONLY - Run these one at a time, do not call this target directly
	nvm install --lts
	nvm use --lts
	npm install -g corepack
	rm ~/.pnp.cjs
	corepack enable
	yarn set version stable
	yarn dlx @yarnpkg/sdks vscode
	yarn install
	yarn plugin import https://raw.githubusercontent.com/spdx/yarn-plugin-spdx/main/bundles/@yarnpkg/plugin-spdx.js
	yarn plugin import https://github.com/CycloneDX/cyclonedx-node-yarn/releases/latest/download/yarn-plugin-cyclonedx.cjs
	npx wrangler queues --cwd queue-consumers/scan-processor consumer worker add scan-queue vulnetix-scan-processor
	npx wrangler queues --cwd queue-consumers/scan-processor consumer worker remove scan-queue vulnetix-scan-processor

info: ## get info about the current cloudflare project
	npx wrangler whoami
	@echo "Local"
	npx wrangler pages info --local
	npx wrangler d1 list --local
	npx wrangler d1 info vulnetix --local
	@echo "Remote"
	npx wrangler pages info --remotw
	npx wrangler pages deployment list --project-name vulnetix
	npx wrangler queues --cwd queue-consumers/scan-processor info scan-queue
	npx wrangler d1 list --remote
	npx wrangler d1 info vulnetix --remote

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
	semgrep scan $(SEMGREP_ARGS) $(SEMGREP_RULES) | jq >semgrep.sarif.json

sbom: clean ## generate CycloneDX from NPM for this project
	npx cyclonedx --spec-version 1.6 --output-format JSON --output-file vulnetix.cdx.json
	npx spdx

deployments: ## FOR DOCO ONLY
	npx wrangler pages deployment list --project-name vulnetix

types:
	npx wrangler types
	DATABASE_URL=$(DATABASE_URL) npx prisma generate

build: types ## build the project for production
	uv run --with requests,rich -s .repo/get_cwe.py .repo/cwe-latest.json --view 699 --insecure --show-stats && \
		uv run --with rich -s .repo/parse_cwe.py .repo/cwe-latest.json
	node src/@iconify/build-icons.js
	npx vite build --force --clearScreen --mode production --outDir ./dist/client/
	npx wrangler pages functions build --outdir=./dist/worker/

watch: types ## development build with watch
	npx vite build --watch --clearScreen --mode development --sourcemap inline

preview: ## preview the project in development mode
	npx wrangler dev ./dist --port 8788 --local --config ./wrangler.toml --config ./queue-consumers/scan-processor/wrangler.toml

consumer: ## Run the scan processor queue consumer
	npx wrangler --cwd=queue-consumers/scan-processor types
	npx wrangler --cwd=queue-consumers/scan-processor dev --config queue-consumers/scan-processor/wrangler.toml

build-staging:
	yarn up
	npm run postinstall
	npx vite build --force --clearScreen --mode production --outDir ./dist/client/ --sourcemap inline
	npx wrangler pages functions build --outdir=./dist/worker/

deploy-prod: build ## WARNING: this is only used if GitOps is broken, and cannot inherit Console Env vars!!! Manually Deploy the production build to Cloudflare Pages
	npx wrangler pages deployment create ./dist --project-name vulnetix --branch main -c wrangler-prod.toml

deploy-staging: types build-staging ## WARNING: this is only used if GitOps is broken, and cannot inherit Console Env vars!!! Manually Deploy the staging build to Cloudflare Pages
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
	npx wrangler d1 execute vulnetix --local --command 'INSERT INTO MemberGroups (memberUuid, groupUuid) SELECT uuid, "8ac52122-b9ae-40fb-b4c6-7c83238ae8d6" FROM Member;'
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
