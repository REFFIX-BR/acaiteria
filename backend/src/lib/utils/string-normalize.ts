/**
 * Utilitários para normalização e comparação de strings
 * Usado para busca aproximada de bairros e outros dados
 */

/**
 * Remove acentos de uma string
 * Ex: "São Paulo" -> "Sao Paulo"
 */
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normaliza uma string para comparação:
 * - Remove acentos
 * - Converte para minúsculas
 * - Remove espaços extras e trim
 * - Remove caracteres especiais comuns
 */
export function normalizeString(str: string): string {
  if (!str) return ''
  
  return removeAccents(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único espaço
}

/**
 * Calcula a distância de Levenshtein entre duas strings
 * Retorna o número mínimo de edições necessárias para transformar str1 em str2
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  
  // Se uma das strings for vazia, retorna o comprimento da outra
  if (len1 === 0) return len2
  if (len2 === 0) return len1
  
  // Cria matriz de distâncias
  const matrix: number[][] = []
  
  // Inicializa primeira linha e coluna
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  // Preenche a matriz
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletar
        matrix[i][j - 1] + 1,      // Inserir
        matrix[i - 1][j - 1] + cost // Substituir
      )
    }
  }
  
  return matrix[len1][len2]
}

/**
 * Calcula a similaridade entre duas strings (0-100%)
 * Usa a distância de Levenshtein normalizada
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1)
  const normalized2 = normalizeString(str2)
  
  if (normalized1 === normalized2) {
    return 100
  }
  
  if (normalized1.length === 0 || normalized2.length === 0) {
    return 0
  }
  
  const maxLength = Math.max(normalized1.length, normalized2.length)
  const distance = levenshteinDistance(normalized1, normalized2)
  
  // Calcula similaridade como porcentagem
  // Similaridade = (1 - distância/máximo_comprimento) * 100
  const similarity = ((maxLength - distance) / maxLength) * 100
  
  return Math.max(0, Math.min(100, similarity))
}

/**
 * Verifica se uma string contém outra (normalizado)
 * Útil para busca parcial
 */
export function containsNormalized(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeString(haystack)
  const normalizedNeedle = normalizeString(needle)
  
  return normalizedHaystack.includes(normalizedNeedle)
}

