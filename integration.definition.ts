import { z, IntegrationDefinition } from '@botpress/sdk'
import { integrationName } from './package.json'

export default new IntegrationDefinition({
  name: integrationName,
  version: '0.1.0',
  readme: 'hub.md',
  icon: 'icon.svg',
  configuration: {
    schema: z.object({
      backendUrl: z
        .string()
        .describe('URL do servidor Google Business (ex.: http://127.0.0.1:3001)'),
      clientId: z.string().describe('Identificador do cliente/tenant no sistema'),
      apiKey: z
        .string()
        .optional()
        .describe('Opcional. Mesmo valor de GOOGLE_BUSINESS_API_KEY no servidor'),
      businessName: z.string().optional().describe('Nome da empresa para respostas'),
      toneOfVoice: z.string().optional().describe('Tom de voz das respostas'),
      businessType: z.string().optional().describe('Tipo de negócio'),
    }),
  },
  actions: {
    getOAuthUrl: {
      title: 'URL OAuth Google Meu Negócio',
      description: 'Gera URL para o cliente conectar a conta Google via OAuth',
      input: { schema: z.object({}) },
      output: {
        schema: z.object({
          url: z.string(),
          state: z.string().optional(),
        }),
      },
    },
    getConnectionStatus: {
      title: 'Status da conexão Google',
      description: 'Verifica se o cliente já autorizou o Google Meu Negócio',
      input: { schema: z.object({}) },
      output: {
        schema: z.object({
          connected: z.boolean(),
          status: z.string(),
          lastError: z.string().optional(),
        }),
      },
    },
    listAccounts: {
      title: 'Listar contas Google Business',
      description: 'Lista contas Google Business Profile do cliente conectado',
      input: { schema: z.object({}) },
      output: {
        schema: z.object({
          accounts: z.array(
            z.object({
              accountId: z.string(),
              accountName: z.string(),
            }),
          ),
        }),
      },
    },
    listLocations: {
      title: 'Listar localizações',
      description: 'Lista localizações de uma conta Google Business',
      input: {
        schema: z.object({
          accountId: z.string().optional(),
        }),
      },
      output: {
        schema: z.object({
          locations: z.array(
            z.object({
              locationId: z.string(),
              title: z.string(),
              address: z.string().optional(),
            }),
          ),
        }),
      },
    },
    syncReviews: {
      title: 'Sincronizar avaliações',
      description: 'Importa avaliações de uma localização Google Business',
      input: {
        schema: z.object({
          locationId: z.string(),
          accountId: z.string().optional(),
        }),
      },
      output: {
        schema: z.object({
          reviews: z.array(z.record(z.unknown())),
        }),
      },
    },
    suggestReply: {
      title: 'Sugerir resposta',
      description: 'Gera sugestão de resposta para uma avaliação (template ou IA)',
      input: {
        schema: z.object({
          locationId: z.string(),
          reviewId: z.string(),
        }),
      },
      output: {
        schema: z.object({
          reply: z.string(),
          requiresApproval: z.boolean(),
          autoPublishAllowed: z.boolean(),
        }),
      },
    },
    publishReply: {
      title: 'Publicar resposta',
      description: 'Publica resposta em uma avaliação do Google Meu Negócio',
      input: {
        schema: z.object({
          locationId: z.string(),
          reviewId: z.string(),
          reply: z.string(),
          accountId: z.string().optional(),
          force: z.boolean().optional(),
        }),
      },
      output: {
        schema: z.object({
          success: z.boolean(),
          reviewId: z.string().optional(),
        }),
      },
    },
    autoReply: {
      title: 'Resposta automática',
      description: 'Aplica regras automáticas e publica quando permitido (1-3★ exige aprovação)',
      input: {
        schema: z.object({
          locationId: z.string(),
          reviewId: z.string(),
          accountId: z.string(),
        }),
      },
      output: {
        schema: z.object({
          published: z.boolean(),
          requiresApproval: z.boolean(),
          suggestedReply: z.string().optional(),
        }),
      },
    },
  },
})
