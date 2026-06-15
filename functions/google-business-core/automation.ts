import axios from 'axios'
import { getOpenAiApiKey } from './constants'
import { CompanyAiSettingsDoc, GoogleBusinessProfileConfig, ReplyOrigin } from './types'

export interface SuggestedReplyResult {
  reply: string
  requiresApproval: boolean
  origin: ReplyOrigin
  autoPublishAllowed: boolean
  internalStatus: 'pending_approval' | 'published' | 'ignored' | 'not_responded'
}

function resolveProfile(
  aiSettings?: CompanyAiSettingsDoc | null,
  connectionProfile?: GoogleBusinessProfileConfig,
): GoogleBusinessProfileConfig {
  return {
    businessName: aiSettings?.businessName || connectionProfile?.businessName || 'nossa empresa',
    businessType: aiSettings?.businessType || connectionProfile?.businessType || 'negócio local',
    toneOfVoice: aiSettings?.toneOfVoice || connectionProfile?.toneOfVoice || 'cordial e profissional',
    languageRestrictions:
      aiSettings?.languageRestrictions ||
      connectionProfile?.languageRestrictions ||
      'Não prometa reembolso, descontos, brindes ou soluções específicas. Seja breve e cordial.',
  }
}

export class GoogleBusinessAutomation {
  async generateSuggestedReply(input: {
    starRating?: number
    comment?: string
    reviewerName?: string
    aiSettings?: CompanyAiSettingsDoc | null
    businessProfile?: GoogleBusinessProfileConfig
    alreadyResponded?: boolean
  }): Promise<SuggestedReplyResult> {
    if (input.alreadyResponded) {
      return {
        reply: '',
        requiresApproval: false,
        origin: 'template',
        autoPublishAllowed: false,
        internalStatus: 'ignored',
      }
    }

    const profile = resolveProfile(input.aiSettings, input.businessProfile)
    const stars = input.starRating ?? 0
    const hasComment = !!input.comment?.trim()
    const businessName = profile.businessName || 'nossa empresa'

    if (stars === 5 && !hasComment) {
      return {
        reply: `Olá! Muito obrigado por avaliar a ${businessName} com 5 estrelas. Ficamos felizes com sua confiança!`,
        requiresApproval: false,
        origin: 'template',
        autoPublishAllowed: true,
        internalStatus: 'published',
      }
    }

    if ((stars === 4 || stars === 5) && hasComment) {
      const aiReply = await this.tryGenerateAiReply(input, profile)
      const reply =
        aiReply ||
        `Olá${input.reviewerName ? `, ${input.reviewerName}` : ''}! Muito obrigado pela avaliação e pelo seu feedback sobre a ${businessName}. Valorizamos muito sua opinião.`

      return {
        reply,
        requiresApproval: false,
        origin: aiReply ? 'ai' : 'template',
        autoPublishAllowed: true,
        internalStatus: 'published',
      }
    }

    if (stars >= 1 && stars <= 3) {
      const aiReply = await this.tryGenerateAiReply(input, profile)
      return {
        reply:
          aiReply ||
          `Olá${input.reviewerName ? `, ${input.reviewerName}` : ''}. Agradecemos por compartilhar sua experiência com a ${businessName}. Lamentamos que não tenha sido ideal e gostaríamos de melhorar. Entre em contato pelos nossos canais oficiais para que possamos ajudá-lo.`,
        requiresApproval: true,
        origin: aiReply ? 'ai' : 'template',
        autoPublishAllowed: false,
        internalStatus: 'pending_approval',
      }
    }

    return {
      reply: `Olá! Obrigado por avaliar a ${businessName}.`,
      requiresApproval: true,
      origin: 'template',
      autoPublishAllowed: false,
      internalStatus: 'pending_approval',
    }
  }

  private async tryGenerateAiReply(
    input: {
      starRating?: number
      comment?: string
      reviewerName?: string
    },
    profile: GoogleBusinessProfileConfig,
  ): Promise<string | null> {
    const apiKey = getOpenAiApiKey()
    if (!apiKey) return null

    const businessName = profile.businessName || 'nossa empresa'
    const tone = profile.toneOfVoice || 'cordial e profissional'
    const restrictions =
      profile.languageRestrictions ||
      'Não prometa reembolso, descontos, brindes ou soluções específicas. Não mencione que é IA.'

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content: `Redija respostas públicas a avaliações do Google Meu Negócio.
Empresa: ${businessName}
Tipo de negócio: ${profile.businessType || 'negócio local'}
Tom de voz: ${tone}
Restrições: ${restrictions}
Responda em português do Brasil, em no máximo 3 frases.
Não invente informações.
Não prometa descontos, brindes ou soluções específicas.
Não mencione que é IA.
Em avaliações negativas, acolha o cliente e oriente contato pelos canais oficiais.`,
            },
            {
              role: 'user',
              content: `Nome do avaliador: ${input.reviewerName || 'Cliente'}
Nota: ${input.starRating ?? 'N/A'} estrelas
Comentário: ${input.comment || '(sem comentário)'}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      )

      const text = response.data?.choices?.[0]?.message?.content?.trim()
      return text || null
    } catch {
      return null
    }
  }
}
