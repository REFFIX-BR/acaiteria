/**
 * Integração com ViaCEP API
 * Busca informações de endereço a partir do CEP
 */

export interface ViaCEPResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface AddressInfo {
  neighborhood: string
  city: string
  state: string
  address: string
  zipCode: string
}

/**
 * Busca informações de endereço pelo CEP usando ViaCEP
 * @param cep CEP com ou sem formatação (ex: "12345-678" ou "12345678")
 * @returns Informações do endereço ou null se não encontrado
 */
export async function fetchAddressByCEP(cep: string): Promise<AddressInfo | null> {
  try {
    // Remove formatação do CEP (mantém apenas números)
    const cleanCEP = cep.replace(/\D/g, '')

    // Valida se tem 8 dígitos
    if (cleanCEP.length !== 8) {
      throw new Error('CEP deve conter 8 dígitos')
    }

    // Chama API ViaCEP
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Erro ao buscar CEP: ${response.status}`)
    }

    const data: ViaCEPResponse = await response.json()

    // Verifica se retornou erro
    if (data.erro === true) {
      return null
    }

    // Valida se tem bairro (alguns CEPs podem não ter)
    if (!data.bairro || data.bairro.trim() === '') {
      console.warn(`[ViaCEP] CEP ${cleanCEP} não possui bairro cadastrado`)
      return null
    }

    return {
      neighborhood: data.bairro.trim(),
      city: data.localidade.trim(),
      state: data.uf.trim(),
      address: data.logradouro.trim(),
      zipCode: cleanCEP,
    }
  } catch (error) {
    console.error('[ViaCEP] Erro ao buscar CEP:', error)
    throw error
  }
}

