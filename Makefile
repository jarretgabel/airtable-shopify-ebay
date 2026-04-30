.PHONY: validate-runtime-config validate-staging-deploy-config validate-prod-deploy-config build-cloudfront deploy-staging deploy-prod deploy-staging-runtime deploy-prod-runtime

validate-runtime-config:
	npm run validate:runtime-config

validate-staging-deploy-config:
	node scripts/validate-cloudfront-deploy-config.mjs .cloudfront-frontend.staging.deploy.json

validate-prod-deploy-config:
	node scripts/validate-cloudfront-deploy-config.mjs .cloudfront-frontend.prod.deploy.json

build-cloudfront:
	npm run build:cloudfront

deploy-staging: validate-staging-deploy-config
	npm run deploy:cloudfront -- --config .cloudfront-frontend.staging.deploy.json

deploy-prod: validate-prod-deploy-config
	npm run deploy:cloudfront -- --config .cloudfront-frontend.prod.deploy.json

deploy-staging-runtime: validate-staging-deploy-config
	npm run deploy:cloudfront:runtime-only -- --config .cloudfront-frontend.staging.deploy.json

deploy-prod-runtime: validate-prod-deploy-config
	npm run deploy:cloudfront:runtime-only -- --config .cloudfront-frontend.prod.deploy.json