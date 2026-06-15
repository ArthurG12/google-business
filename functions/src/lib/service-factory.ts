import { GoogleBusinessService } from '../../google-business-core/service'
import { applySecretsToProcessEnv } from '../config/secrets'

let service: GoogleBusinessService | null = null

export function getService(): GoogleBusinessService {
  applySecretsToProcessEnv()
  if (!service) {
    service = new GoogleBusinessService()
  }
  return service
}
