import dotenv from 'dotenv'
import { createApp } from './create-app'
import { checkGoogleBusinessConfig, isGoogleBusinessReady } from '../google-business/config-check'

dotenv.config()

const port = Number(process.env.PORT || 3001)
const app = createApp()

app.listen(port, () => {
  console.log(`Google Business API rodando em http://127.0.0.1:${port}`)
  console.log(`Painel: http://127.0.0.1:${port}/api/v1/google-business/panel`)
  console.log(`Health: http://127.0.0.1:${port}/api/v1/google-business/health`)

  const checks = checkGoogleBusinessConfig()
  if (!isGoogleBusinessReady()) {
    console.warn('\n⚠ Configuração incompleta:')
    for (const item of checks.filter((c) => !c.ok)) {
      console.warn(`  - ${item.message}`)
    }
    console.warn('')
  }
})
