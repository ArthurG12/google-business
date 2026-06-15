# Google Meu Negócio

Integração Botpress para **Google Business Profile** (avaliações e respostas).

## Arquitetura

```text
Botpress actions → backendUrl (/api/v1/google-business/*)
Servidor Express → Google APIs + Firestore
Painel HTML → OAuth e gestão manual de respostas
```

## Configuração no Botpress

| Campo | Descrição |
|-------|-----------|
| `backendUrl` | URL do servidor Express (ex.: `https://api.seudominio.com` ou `http://127.0.0.1:3001`) |
| `clientId` | Identificador do tenant/cliente (ex.: `doutor-celulares`) |
| `apiKey` | Opcional. Mesmo valor de `GOOGLE_BUSINESS_API_KEY` no servidor |
| `businessName` | Nome da empresa (usado nas respostas automáticas) |
| `toneOfVoice` | Tom de voz das respostas |
| `businessType` | Tipo de negócio |

## Actions

- `getOAuthUrl` — gera link OAuth para o cliente conectar o Google
- `getConnectionStatus` — verifica se a conta está conectada
- `listAccounts` — lista contas Google Business
- `listLocations` — lista localizações
- `syncReviews` — importa avaliações de uma localização
- `suggestReply` — sugere resposta (template ou OpenAI)
- `publishReply` — publica resposta manual
- `autoReply` — aplica regras automáticas (1–3★ exige aprovação)

## Painel

```
{backendUrl}/api/v1/google-business/panel?clientId=seu-cliente
```
