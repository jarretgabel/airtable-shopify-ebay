# AWS SAM Deploy Runbook

This is the concrete operator runbook for taking the current `aws/` package from local validation to a deployed AWS Lambda + API Gateway environment.

Use this together with [docs/aws-deployment-checklist.md](/Users/user/Sites/airtable-shopify-ebay/docs/aws-deployment-checklist.md).

## Scope

This runbook covers the current SAM package in [aws/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/template.yaml).

It does not cover:

- eBay Lambda deployment
- custom domain setup
- CI/CD pipeline automation
- full secret rotation policy

## Before you start

Confirm all of these first:

1. The repo is building cleanly.
2. `npm run compare:lambda` is passing locally.
3. Shopify app permissions are fixed if you expect `/api/shopify/images` to work after deploy.
4. You have AWS CLI and SAM CLI installed and authenticated.
5. You know which AWS account and region this should deploy to.

Current state in this workspace:

- `sam` CLI is installed and callable via the user Python bin path.
- `aws` CLI is installed and callable via the user Python bin path.
- AWS credentials are not configured on this machine yet.
- [aws/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/template.yaml) is parameterized for SSM-backed secret paths plus deploy-time config values and the SAM build succeeds locally.

What that means:

- a remote deploy is still possible once AWS credentials are configured
- and you no longer need manual Lambda console environment entry if you deploy through SAM with parameters

## Local prep

From [aws](/Users/user/Sites/airtable-shopify-ebay/aws):

```bash
npm install
sam build --template-file template.yaml
```

Expected result:

- SAM build succeeds
- `.aws-sam/build` is created

Install commands if this machine is missing the CLIs:

```bash
brew install awscli aws-sam-cli
aws configure
```

Fallback if Homebrew is unavailable but Python packaging is available:

```bash
python3 -m pip install --user awscli aws-sam-cli
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
aws configure
```

Reusable deploy config example:

- [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example)

## Recommended stack naming

Use one stack per environment.

Suggested names:

- `airtable-shopify-ebay-dev`
- `airtable-shopify-ebay-staging`
- `airtable-shopify-ebay-prod`

## Recommended region choice

Pick one region and stay consistent unless there is a compliance reason to split.

Suggested default:

- `us-east-1`

## `sam deploy --guided` run

From [aws](/Users/user/Sites/airtable-shopify-ebay/aws):

```bash
sam deploy --guided --template-file template.yaml
```

Use answers like these on the first run.

### Guided prompt answers

`Stack Name`:

- dev: `airtable-shopify-ebay-dev`
- staging: `airtable-shopify-ebay-staging`
- prod: `airtable-shopify-ebay-prod`

`AWS Region`:

- use your selected deploy region, for example `us-east-1`

`Confirm changes before deploy`:

- `Y` for production
- `N` is acceptable for dev if you want faster iteration

`Allow SAM CLI IAM role creation`:

- `Y` unless your org requires precreated roles

`Disable rollback`:

- `N`

`Save arguments to configuration file`:

- `Y`

`SAM configuration file`:

- default `samconfig.toml`

`SAM configuration environment`:

- `dev`
- `staging`
- `prod`

## What to capture after deploy

Record these values immediately:

1. Stack name
2. Region
3. API Gateway URL from `AppApiUrl`
4. Any function-specific environment overrides you added
5. Where the secrets are stored

## Production env matrix

This package expects plain environment variables in Lambda.

Use this matrix to populate AWS runtime config.

| AWS runtime env | Source today | Required | Notes |
| --- | --- | --- | --- |
| `AIRTABLE_API_KEY` | `VITE_AIRTABLE_API_KEY` | Yes | Keep in AWS secret storage only |
| `AIRTABLE_BASE_ID` | `VITE_AIRTABLE_BASE_ID` | Yes | Core Airtable base id |
| `ALLOWED_AIRTABLE_TABLE_NAME` | `VITE_AIRTABLE_TABLE_NAME` | Yes | Listings route guard |
| `ALLOWED_AIRTABLE_VIEW_ID` | `VITE_AIRTABLE_VIEW_ID` | Yes | Listings route guard |
| `AIRTABLE_USERS_TABLE_REF` | `VITE_AIRTABLE_USERS_TABLE_REF` | Yes | Auth/users configured source |
| `AIRTABLE_USERS_TABLE_NAME` | `VITE_AIRTABLE_USERS_TABLE_NAME` | Yes | Auth/users configured source |
| `AIRTABLE_APPROVAL_TABLE_REF` | `VITE_AIRTABLE_APPROVAL_TABLE_REF` | Yes | eBay approval source |
| `AIRTABLE_APPROVAL_TABLE_NAME` | `VITE_AIRTABLE_APPROVAL_TABLE_NAME` | Yes | eBay approval source |
| `AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF` | `VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF` | Yes | Shopify approval source |
| `AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME` | `VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME` | Yes | Shopify approval source |
| `AIRTABLE_COMBINED_LISTINGS_TABLE_REF` | `VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF` | Yes | Combined approval source |
| `AIRTABLE_COMBINED_LISTINGS_TABLE_NAME` | `VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME` | Yes | Combined approval source |
| `SHOPIFY_STORE_DOMAIN` | `VITE_SHOPIFY_STORE_DOMAIN` | Yes | Must match installed app store |
| `SHOPIFY_ACCESS_TOKEN` | `VITE_SHOPIFY_OAUTH_ACCESS_TOKEN` or admin token | Yes | Needs file/image scope for image upload |
| `JOTFORM_API_KEY` | `VITE_JOTFORM_API_KEY` | Yes | Required for JotForm routes |
| `GITHUB_TOKEN` | `VITE_GITHUB_TOKEN` | Optional | Use if AI route should use GitHub Models |
| `OPENAI_API_KEY` | `VITE_OPENAI_API_KEY` | Optional | Use if AI route should use OpenAI |
| `GOOGLE_GMAIL_ACCESS_TOKEN` | `VITE_GOOGLE_GMAIL_ACCESS_TOKEN` | Optional | Only if Gmail Lambda route is enabled |
| `GOOGLE_GMAIL_FROM_EMAIL` | `VITE_GOOGLE_GMAIL_FROM_EMAIL` | Optional | Sender identity |

Concrete example files for the first remote deploy are included in:

- [aws/deploy/dev.lambda-env.example.json](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/dev.lambda-env.example.json)
- [aws/deploy/dev.frontend.example.env](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/dev.frontend.example.env)
- [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example)

Primary secret path model:

- secrets go in AWS Systems Manager Parameter Store as `SecureString`
- the SAM template receives the SSM parameter paths
- Lambda environment variables resolve from `ssm-secure` dynamic references at deploy time

## Frontend environment matrix after deploy

Once AWS is deployed, update frontend env outside the AWS package.

### Dev against deployed AWS

```env
VITE_APP_API_BASE_URL=https://your-api-id.execute-api.your-region.amazonaws.com
VITE_USE_LAMBDA_AIRTABLE=true
VITE_USE_LAMBDA_SHOPIFY=true
VITE_USE_LAMBDA_JOTFORM=true
VITE_USE_LAMBDA_AI=false
VITE_USE_LAMBDA_GMAIL=false
```

### Staging

```env
VITE_APP_API_BASE_URL=https://your-staging-api-id.execute-api.your-region.amazonaws.com
VITE_USE_LAMBDA_AIRTABLE=true
VITE_USE_LAMBDA_SHOPIFY=true
VITE_USE_LAMBDA_JOTFORM=true
VITE_USE_LAMBDA_AI=true
VITE_USE_LAMBDA_GMAIL=true
```

### Production

```env
VITE_APP_API_BASE_URL=https://your-prod-api-id.execute-api.your-region.amazonaws.com
VITE_USE_LAMBDA_AIRTABLE=true
VITE_USE_LAMBDA_SHOPIFY=true
VITE_USE_LAMBDA_JOTFORM=true
VITE_USE_LAMBDA_AI=true
VITE_USE_LAMBDA_GMAIL=true
```

Notes:

- `VITE_APP_API_PROXY_TARGET` is for local proxying only and should not be used for deployed environments.
- eBay is still separate from this AWS package.

## Secret storage recommendation

Preferred:

1. Store secrets in AWS Secrets Manager or SSM Parameter Store.
2. Inject them as Lambda environment variables at deploy time.
3. Keep stack config separate by environment.

Avoid:

- copying local example files directly into cloud environments
- storing provider secrets in frontend-hosted env vars for deployed use

You can now keep the deploy fully template-managed by using SAM parameters for config values and SSM SecureString parameter paths for secrets.

Recommended first pass:

1. copy [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example) to `aws/samconfig.toml`
2. create the required SSM `SecureString` parameters in AWS Parameter Store
3. replace the placeholder parameter values locally
3. run `sam deploy --config-env dev`

Do not commit real secret values to source control.

Local safety defaults already added in this repo:

- local [aws/samconfig.toml](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml) copies are gitignored
- local [aws/deploy/ssm-setup.sh](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/ssm-setup.example.sh) copies are gitignored

## SSM parameter naming recommendation

Recommended naming pattern:

- `/airtable-shopify-ebay/dev/airtable/api-key`
- `/airtable-shopify-ebay/dev/shopify/access-token`
- `/airtable-shopify-ebay/dev/jotform/api-key`
- `/airtable-shopify-ebay/dev/ai/github-token`
- `/airtable-shopify-ebay/dev/ai/openai-api-key`
- `/airtable-shopify-ebay/dev/gmail/access-token`

Use the same pattern for `staging` and `prod`.

Suggested creation examples:

```bash
aws ssm put-parameter --name /airtable-shopify-ebay/dev/airtable/api-key --type SecureString --value 'replace-me'
aws ssm put-parameter --name /airtable-shopify-ebay/dev/shopify/access-token --type SecureString --value 'replace-me'
aws ssm put-parameter --name /airtable-shopify-ebay/dev/jotform/api-key --type SecureString --value 'replace-me'
```

Reusable helper script:

- [aws/deploy/ssm-setup.example.sh](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/ssm-setup.example.sh)

Recommended use:

1. copy it locally to `aws/deploy/ssm-setup.sh`
2. replace placeholders or export secret values first
3. run it for the target environment before `sam deploy`

## First deployment strategy

Use the narrowest safe cutover first.

Recommended order:

1. Deploy the SAM stack.
2. Point the frontend at the deployed API with `VITE_APP_API_BASE_URL`.
3. Turn on `VITE_USE_LAMBDA_AIRTABLE=true` first.
4. Validate Airtable flows.
5. Turn on `VITE_USE_LAMBDA_SHOPIFY=true`.
6. Validate Shopify reads and publish flow.
7. Validate image upload only after Shopify admin permissions are fixed.
8. Turn on `VITE_USE_LAMBDA_JOTFORM=true`.
9. Turn on AI and Gmail only if those secrets are configured.

## Post-deploy validation runbook

From the repo root:

```bash
npm run build
npm run compare:lambda
npm run probe:lambda:writes
npm run probe:lambda:shopify
```

Then do browser validation for:

1. Users management
2. Incoming Gear
3. Testing
4. Photos
5. Approval save flows
6. Shopify publish flows
7. Image Lab uploads

## Failure interpretation

If these happen:

### `compare:lambda` fails

- check `VITE_APP_API_BASE_URL`
- check Lambda env variable mapping
- check whether the deployed stack is missing one of the configured Airtable refs

### `/api/shopify/images` fails with `fileCreate`

- this is Shopify admin scope/permission debt, not Lambda routing failure

### Airtable configured-source routes fail

- check all approval/users/combined table refs and names in Lambda runtime env

### AI route fails

- confirm at least one of `GITHUB_TOKEN` or `OPENAI_API_KEY` is configured

### Gmail route fails

- confirm both Gmail env vars are configured and the token is still valid

## Recommended artifacts to keep after first deploy

Save these in your ops notes:

1. stack name
2. region
3. deployed `AppApiUrl`
4. secret names/locations
5. frontend env file or hosting config keys changed
6. validation date and result

## Current practical next action

1. Complete the Shopify admin items in [docs/admin-website-checklist.md](/Users/user/Sites/airtable-shopify-ebay/docs/admin-website-checklist.md).
2. Configure AWS credentials on the machine that will deploy.
3. create the required SSM `SecureString` parameters in AWS, preferably with [aws/deploy/ssm-setup.example.sh](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/ssm-setup.example.sh).
4. copy [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example) to local `aws/samconfig.toml` and fill the placeholders.
5. Run the deploy flow above.
6. Flip the frontend Lambda flags one domain at a time using [aws/deploy/dev.frontend.example.env](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/dev.frontend.example.env).