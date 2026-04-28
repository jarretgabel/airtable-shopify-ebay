#!/usr/bin/env bash

set -euo pipefail

# Example bootstrap script for creating or updating the SecureString parameters
# used by aws/template.yaml. Copy this file to a local untracked script such as:
#
#   aws/deploy/ssm-setup.sh
#
# That local copy is gitignored in the repo root.
#
# Then replace the placeholder values or export them before running.
#
# Example:
#   chmod +x aws/deploy/ssm-setup.sh
#   AWS_REGION=us-east-1 DEPLOY_ENV=dev aws/deploy/ssm-setup.sh

DEPLOY_ENV="${DEPLOY_ENV:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
SSM_PREFIX="${SSM_PREFIX:-/airtable-shopify-ebay/${DEPLOY_ENV}}"

AIRTABLE_API_KEY="${AIRTABLE_API_KEY:-replace-with-airtable-pat}"
SHOPIFY_ACCESS_TOKEN="${SHOPIFY_ACCESS_TOKEN:-replace-with-shopify-token}"
JOTFORM_API_KEY="${JOTFORM_API_KEY:-replace-with-jotform-api-key}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
GOOGLE_GMAIL_ACCESS_TOKEN="${GOOGLE_GMAIL_ACCESS_TOKEN:-}"

put_secure_string() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "Skipping empty SecureString: $name"
    return 0
  fi

  aws ssm put-parameter \
    --region "$AWS_REGION" \
    --name "$name" \
    --type SecureString \
    --overwrite \
    --value "$value"
}

echo "Creating/updating SSM SecureString parameters under: $SSM_PREFIX"

put_secure_string "$SSM_PREFIX/airtable/api-key" "$AIRTABLE_API_KEY"
put_secure_string "$SSM_PREFIX/shopify/access-token" "$SHOPIFY_ACCESS_TOKEN"
put_secure_string "$SSM_PREFIX/jotform/api-key" "$JOTFORM_API_KEY"
put_secure_string "$SSM_PREFIX/ai/github-token" "$GITHUB_TOKEN"
put_secure_string "$SSM_PREFIX/ai/openai-api-key" "$OPENAI_API_KEY"
put_secure_string "$SSM_PREFIX/gmail/access-token" "$GOOGLE_GMAIL_ACCESS_TOKEN"

cat <<EOF

Done.

Expected parameter paths for DEPLOY_ENV=$DEPLOY_ENV:
  $SSM_PREFIX/airtable/api-key
  $SSM_PREFIX/shopify/access-token
  $SSM_PREFIX/jotform/api-key
  $SSM_PREFIX/ai/github-token
  $SSM_PREFIX/ai/openai-api-key
  $SSM_PREFIX/gmail/access-token

Next steps:
  1. Update aws/samconfig.toml from aws/samconfig.toml.example.
  2. Fill the non-secret parameters and matching SSM paths.
  3. Run: sam build --template-file template.yaml
  4. Run: sam deploy --config-env $DEPLOY_ENV

EOF