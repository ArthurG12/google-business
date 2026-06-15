#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-therme-gas}"
TOPIC="${2:-google-business-reviews}"
REGION="${3:-us-central1}"

echo "==> Projeto: $PROJECT_ID | Tópico: $TOPIC"

gcloud config set project "$PROJECT_ID"

echo "==> Criando tópico Pub/Sub (ignora se já existir)..."
gcloud pubsub topics create "$TOPIC" --project="$PROJECT_ID" 2>/dev/null || true

echo "==> Permissão para Google Business Profile publicar no tópico..."
gcloud pubsub topics add-iam-policy-binding "$TOPIC" \
  --member="serviceAccount:mybusiness-api-pubsub@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher" \
  --project="$PROJECT_ID"

echo "==> APIs necessárias..."
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  pubsub.googleapis.com \
  mybusinessaccountmanagement.googleapis.com \
  mybusinessbusinessinformation.googleapis.com \
  mybusinessnotifications.googleapis.com \
  --project="$PROJECT_ID"

echo ""
echo "Próximo passo: configurar secrets e fazer deploy"
echo "  cd bp-integrations/google-business"
echo "  firebase deploy --only functions,firestore:rules"
