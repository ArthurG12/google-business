# Deploy Firebase (Blaze) — Google Business

Projeto: **therme-gas** | Região: **us-central1**

## Functions exportadas

| Function | URL / trigger |
|----------|----------------|
| `googleBusinessApi` | `https://us-central1-therme-gas.cloudfunctions.net/googleBusinessApi` |
| `onGoogleBusinessReviewWebhook` | `https://us-central1-therme-gas.cloudfunctions.net/onGoogleBusinessReviewWebhook` |
| `onGoogleBusinessReviewNotification` | Pub/Sub tópico `google-business-reviews` |

## 1. Pub/Sub

```bash
chmod +x scripts/setup-pubsub.sh
./scripts/setup-pubsub.sh therme-gas google-business-reviews
```

## 2. Secrets (obrigatório antes do deploy)

```bash
cd bp-integrations/google-business

firebase functions:secrets:set GOOGLE_CLIENT_ID
firebase functions:secrets:set GOOGLE_CLIENT_SECRET
firebase functions:secrets:set GOOGLE_REDIRECT_URI
# Produção:
# https://us-central1-therme-gas.cloudfunctions.net/googleBusinessApi/google-business/oauth/callback

firebase functions:secrets:set TOKEN_ENCRYPTION_KEY
firebase functions:secrets:set GOOGLE_PUBSUB_TOPIC
# valor: google-business-reviews

firebase functions:secrets:set WEBHOOK_SECRET
# opcional: senha para POST no webhook HTTP

firebase functions:secrets:set OPENAI_API_KEY
# opcional
```

## 3. Deploy

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

## 4. OAuth em produção

No Google Cloud Console → OAuth client, adicione redirect URI:

```
https://us-central1-therme-gas.cloudfunctions.net/googleBusinessApi/google-business/oauth/callback
```

## 5. Testar webhook (sem Google)

```bash
curl -X POST "https://us-central1-therme-gas.cloudfunctions.net/onGoogleBusinessReviewWebhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_WEBHOOK_SECRET" \
  -d '{
    "type": "NEW_REVIEW",
    "reviewName": "accounts/123/locations/456/reviews/789",
    "locationName": "accounts/123/locations/456"
  }'
```

Verifique Firestore → `googleBusinessNotificationEvents`.

## 6. Após aprovação GBP API (quota 300/min)

1. Conectar OAuth via `googleBusinessApi/oauth/start`
2. `POST .../notifications/setup?clientId=...`
3. Opcional: `GOOGLE_BUSINESS_AUTO_PROCESS_NOTIFICATIONS=true` no secret/env para auto-responder
