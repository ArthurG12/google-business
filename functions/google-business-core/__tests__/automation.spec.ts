import { GoogleBusinessAutomation } from '../automation'

describe('GoogleBusinessAutomation', () => {
  const automation = new GoogleBusinessAutomation()

  it('5 estrelas sem comentário → template auto-publicável', async () => {
    const result = await automation.generateSuggestedReply({
      starRating: 5,
      comment: '',
      businessProfile: { businessName: 'Loja Teste' },
    })

    expect(result.autoPublishAllowed).toBe(true)
    expect(result.requiresApproval).toBe(false)
    expect(result.internalStatus).toBe('published')
    expect(result.origin).toBe('template')
    expect(result.reply).toContain('Loja Teste')
  })

  it('4 estrelas com comentário → auto-publicável (fallback template sem OpenAI)', async () => {
    const result = await automation.generateSuggestedReply({
      starRating: 4,
      comment: 'Atendimento excelente',
      reviewerName: 'Maria',
      businessProfile: { businessName: 'Loja Teste' },
    })

    expect(result.autoPublishAllowed).toBe(true)
    expect(result.requiresApproval).toBe(false)
    expect(result.internalStatus).toBe('published')
    expect(result.reply).toContain('Maria')
  })

  it('2 estrelas → pending_approval, nunca auto-publica', async () => {
    const result = await automation.generateSuggestedReply({
      starRating: 2,
      comment: 'Demorou muito',
      reviewerName: 'João',
      businessProfile: { businessName: 'Loja Teste' },
    })

    expect(result.autoPublishAllowed).toBe(false)
    expect(result.requiresApproval).toBe(true)
    expect(result.internalStatus).toBe('pending_approval')
    expect(result.reply.length).toBeGreaterThan(10)
  })

  it('review já respondida → ignored', async () => {
    const result = await automation.generateSuggestedReply({
      starRating: 5,
      comment: 'Ótimo',
      alreadyResponded: true,
    })

    expect(result.internalStatus).toBe('ignored')
    expect(result.autoPublishAllowed).toBe(false)
    expect(result.reply).toBe('')
  })

  it('usa companyAiSettings quando informado', async () => {
    const result = await automation.generateSuggestedReply({
      starRating: 5,
      aiSettings: {
        id: 'client-a',
        clientId: 'client-a',
        businessName: 'Empresa AI',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(result.reply).toContain('Empresa AI')
  })
})
