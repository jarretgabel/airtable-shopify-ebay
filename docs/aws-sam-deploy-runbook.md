# AWS SAM Deploy Runbook

This is the concrete operator runbook for taking the current `aws/` package from local validation to a deployed AWS Lambda + API Gateway environment.

Use this together with [docs/aws-deployment-checklist.md](/Users/user/Sites/airtable-shopify-ebay/docs/aws-deployment-checklist.md).

## Scope

This runbook covers the current SAM package in [aws/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/template.yaml).

It does not cover:

- custom domain setup
- CI/CD pipeline automation
- full secret rotation policy

## Before you start

Confirm all of these first:

1. The repo is building cleanly.
2. `npm run local:api:check` succeeds against the no-Docker local adapter.
3. `npm run compare:lambda` is passing locally.
4. Shopify app permissions are fixed if you expect `/api/shopify/images` to work after deploy.
5. You have AWS CLI and SAM CLI installed and authenticated.
6. You know which AWS account and region this should deploy to.

Current state in this workspace:

- `sam` CLI is installed and callable via the user Python bin path.
- `aws` CLI is installed and callable via the user Python bin path.
- AWS credentials are not configured on this machine yet.
- [aws/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/template.yaml) is parameterized for direct `NoEcho` secret values plus deploy-time config values and the SAM build succeeds locally.

What that means:

- a remote deploy is still possible once AWS credentials are configured
- and you no longer need manual Lambda console environment entry if you deploy through SAM with parameters

## Local prep

From [aws](/Users/user/Sites/airtable-shopify-ebay/aws):

```bash
npm install
npm run build
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

Once those tools are installed, the npm scripts in [aws/package.json](/Users/user/Sites/airtable-shopify-ebay/aws/package.json) already include the required PATH entries for the user-installed CLIs and local `esbuild` binary.

Reusable deploy config example:

- [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example)

Important: deploy the built SAM template, not the source template. The npm deploy scripts in [aws/package.json](/Users/user/Sites/airtable-shopify-ebay/aws/package.json) now run `sam build` first and deploy [aws/.aws-sam/build/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/.aws-sam/build/template.yaml). This avoids shipping unbuilt TypeScript handler paths to Lambda.

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
npm run deploy:guided
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

## IAM permissions required for SAM deploy

If `npm run deploy:dev` fails with `cloudformation:CreateChangeSet` on `aws-sam-cli-managed-default`, the AWS user or role can authenticate but does not have enough deployment permissions for SAM-managed CloudFormation resources.

The Python 3.9 deprecation warning from `boto3` is not the deploy blocker right now. It is only a warning. The actual blocking error is the CloudFormation `AccessDenied` response.

Minimum CloudFormation access for SAM deploy:

- `cloudformation:CreateChangeSet`
- `cloudformation:DescribeChangeSet`
- `cloudformation:ExecuteChangeSet`
- `cloudformation:DescribeStacks`
- `cloudformation:GetTemplateSummary`
- `cloudformation:CreateStack`
- `cloudformation:UpdateStack`
- `cloudformation:DeleteStack`

Recommended resource scope for the current account and region:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"cloudformation:CreateChangeSet",
				"cloudformation:DescribeChangeSet",
				"cloudformation:ExecuteChangeSet",
				"cloudformation:DescribeStacks",
				"cloudformation:GetTemplateSummary",
				"cloudformation:CreateStack",
				"cloudformation:UpdateStack",
				"cloudformation:DeleteStack"
			],
			"Resource": [
				"arn:aws:cloudformation:us-east-1:981750770208:stack/aws-sam-cli-managed-default/*",
				"arn:aws:cloudformation:us-east-1:981750770208:stack/airtable-shopify-ebay-*/*"
			]
		}
	]
}
```

In practice, full SAM deploys usually need more than CloudFormation alone. Expect to also need:

- S3 access for SAM packaging artifacts
- Lambda create and update permissions
- API Gateway permissions
- `iam:PassRole`
- IAM create or update permissions if the stack creates roles and policies

For this repo, a concrete policy example now lives at [aws/deploy/sam-deployer-policy.example.json](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/sam-deployer-policy.example.json).

This example is intentionally practical rather than ultra-minimal. It covers the actual failure modes already seen in this account:

- CloudFormation change set and stack management
- SAM artifact bucket creation and policy updates
- Lambda function create and update
- API Gateway HTTP API create and update
- IAM role create, tag, attach, detach, pass, and delete for stack-created Lambda roles
- CloudWatch log group create and tag operations

Add CloudWatch Logs read access too if you want to debug deployed runtime failures from the CLI. The policy example includes `logs:FilterLogEvents`, `logs:GetLogEvents`, and `logs:DescribeLogStreams` for that reason.

Where to put it:

1. Open AWS Console.
2. Go to IAM.
3. Open Policies.
4. Create policy.
5. Switch to JSON.
6. Paste the contents of [aws/deploy/sam-deployer-policy.example.json](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/sam-deployer-policy.example.json).
7. Save it as a customer managed policy, for example `AirtableShopifyEbaySamDeployer`.
8. Attach that policy to the IAM principal that runs `sam deploy`.

For this machine and current setup, that principal is the IAM user `resolutionavnyc` unless you later switch to an assumed role or SSO profile.

Fastest safe attachment options:

1. Attach it directly to the IAM user `resolutionavnyc` if this user is only for deployment/admin work.
2. Prefer attaching it to a dedicated IAM group if multiple human deployers need the same access.
3. Best long-term option is attaching it to a deployment role and using `aws sts assume-role` or AWS IAM Identity Center, but that is more setup.

If you want the fastest path, ask the AWS admin for deploy rights broad enough to manage the `aws-sam-cli-managed-default` stack and the `airtable-shopify-ebay-*` stacks in `us-east-1`.

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

- secret values are passed as SAM parameters marked `NoEcho`
- the local [aws/samconfig.toml](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml) file stays gitignored and holds the deploy-time secret values
- this avoids manual Lambda console entry while staying compatible with Lambda environment variable support in CloudFormation

## Frontend environment matrix after deploy

Once AWS is deployed, update frontend env outside the AWS package.

### Dev against deployed AWS

```env
VITE_APP_API_BASE_URL=https://your-api-id.execute-api.your-region.amazonaws.com
```

### Staging

```env
VITE_APP_API_BASE_URL=https://your-staging-api-id.execute-api.your-region.amazonaws.com
```

### Production

```env
VITE_APP_API_BASE_URL=https://your-prod-api-id.execute-api.your-region.amazonaws.com
```

Notes:

- `VITE_APP_API_PROXY_TARGET` is for local proxying only and should not be used for deployed environments.
- all supported integrations route through the backend seam by default once the frontend points at the deployed API
- AI and Gmail availability now depends on AWS secret configuration rather than frontend flags

## Secret storage recommendation

Preferred:

1. Keep secret values in the local gitignored [aws/samconfig.toml](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml).
2. Pass them as `NoEcho` SAM parameters at deploy time.
3. Keep stack config separate by environment.

Avoid:

- copying local example files directly into cloud environments
- storing provider secrets in frontend-hosted env vars for deployed use

You can now keep the deploy fully template-managed by using SAM parameters for both config values and secret values, without putting them in the AWS console.

Recommended first pass:

1. copy [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example) to `aws/samconfig.toml`
2. replace the placeholder parameter values locally, including the secret values
4. run `npm run deploy:dev`

Do not commit real secret values to source control.

Local safety defaults already added in this repo:

- local [aws/samconfig.toml](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml) copies are gitignored

## Secret parameter notes

Use the local gitignored [aws/samconfig.toml](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml) for secret parameter values such as:

- `AirtableApiKey`
- `ShopifyAccessToken`
- `JotformApiKey`
- `GithubToken`
- `OpenAiApiKey`
- `GoogleGmailAccessToken`

These parameters are declared with `NoEcho` in [aws/template.yaml](/Users/user/Sites/airtable-shopify-ebay/aws/template.yaml), which keeps them out of normal CloudFormation output while still allowing SAM deployment.

## First deployment strategy

Use the narrowest safe cutover first.

Recommended order:

1. Deploy the SAM stack.
2. Point the frontend at the deployed API with `VITE_APP_API_BASE_URL`.
3. Validate Airtable, auth, and approval flows.
4. Validate Shopify reads and publish flow.
5. Validate image upload only after Shopify admin permissions are fixed.
6. Validate eBay read and publish flows.
7. Validate AI and Gmail only if those secrets are configured.

## Post-deploy validation runbook

From the repo root:

```bash
npm run local:api:check
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

- first rerun `npm run local:api:check`
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
2. Run `npm run aws:whoami` from [aws](/Users/user/Sites/airtable-shopify-ebay/aws) and configure AWS credentials if it fails.
3. copy [aws/samconfig.toml.example](/Users/user/Sites/airtable-shopify-ebay/aws/samconfig.toml.example) to local `aws/samconfig.toml` and fill the placeholders, including secret values.
4. if a prior `aws-sam-cli-managed-default` stack failed, delete it before retrying deploy.
5. Run `npm run deploy:dev` from [aws](/Users/user/Sites/airtable-shopify-ebay/aws).
6. Flip the frontend Lambda flags one domain at a time using [aws/deploy/dev.frontend.example.env](/Users/user/Sites/airtable-shopify-ebay/aws/deploy/dev.frontend.example.env).