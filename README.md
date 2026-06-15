# Google Meu Negócio (Google Business Profile)

Pacote com **servidor Express** + **integração Botpress** para OAuth, sincronização de avaliações e publicação de respostas no Google Meu Negócio.

## Estrutura

```text
src/google-business/   Core (OAuth, API Google, Firestore, automação)
src/backend/           Servidor Express (/api/v1/google-business/*)
src/client/            Cliente HTTP usado pela integração Botpress
public/panel.html      Painel web para conexão e respostas
```

## Pré-requisitos

1. Projeto no **Google Cloud Console** com OAuth 2.0 (Web application)
2. APIs habilitadas:
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business API (reviews)
3. **Firestore** (Firebase Admin) para tokens e avaliações
4. Redirect URI cadastrado no Google:

```
{PUBLIC_URL}/api/v1/google-business/oauth/callback
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_BUSINESS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_BUSINESS_REDIRECT_URI` | Callback OAuth (URL pública) |
| `GOOGLE_BUSINESS_SCOPE` | Escopo OAuth (padrão: `business.manage`) |
| `GOOGLE_BUSINESS_API_KEY` | Opcional. Protege rotas com header `x-api-key` |
| `GOOGLE_BUSINESS_SUCCESS_URL` | Redirect após OAuth (ex.: URL do painel) |
| `GOOGLE_BUSINESS_OPENAI_API_KEY` | Opcional. IA para sugestões de resposta |
| `CRYPTO_SECRET` | Chave para criptografar tokens no Firestore |
| `FIREBASE_PROJECT_ID` | Projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Chave privada (com `\n` escapados) |
| `PORT` | Porta do servidor (padrão: `3001`) |

## Rodar o servidor

```bash
cd bp-integrations/google-business
pnpm install
pnpm run start:server
```

Painel: `http://127.0.0.1:3001/api/v1/google-business/panel`

## Integração Botpress

```bash
pnpm run gen
pnpm run deploy
```

Configuração no bot:

| Campo | Exemplo |
|-------|---------|
| `backendUrl` | `http://127.0.0.1:3001` ou URL pública |
| `clientId` | `meu-cliente` |
| `apiKey` | (se `GOOGLE_BUSINESS_API_KEY` estiver definida) |

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/google-business/panel` | Painel HTML |
| GET | `/api/v1/google-business/oauth/start` | Inicia OAuth |
| GET | `/api/v1/google-business/oauth/callback` | Callback Google |
| GET | `/api/v1/google-business/status` | Status da conexão |
| GET | `/api/v1/google-business/accounts` | Lista contas |
| GET | `/api/v1/google-business/locations` | Lista localizações |
| GET | `/api/v1/google-business/locations/:id/reviews` | Sincroniza avaliações |
| POST | `.../suggest-reply` | Sugere resposta |
| POST | `.../reply` | Publica resposta |
| POST | `.../auto-reply` | Resposta automática |

Query `clientId` é obrigatório em todas as rotas autenticadas.

## Regras de automação

- Avaliações **4–5 estrelas**: podem ser publicadas automaticamente (quando `autoReply` é chamado)
- Avaliações **1–3 estrelas**: geram sugestão mas exigem aprovação humana (`requiresApproval: true`)
