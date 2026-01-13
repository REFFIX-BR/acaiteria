import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OperatingHours } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte nome do dia em português para índice do dia da semana (0 = Domingo, 1 = Segunda, ...)
 */
function getDayOfWeekIndex(dayName: string): number {
  const dayMap: Record<string, number> = {
    'domingo': 0,
    'segunda': 1,
    'segunda-feira': 1,
    'terça': 2,
    'terça-feira': 2,
    'quarta': 3,
    'quarta-feira': 3,
    'quinta': 4,
    'quinta-feira': 4,
    'sexta': 5,
    'sexta-feira': 5,
    'sábado': 6,
    'sabado': 6,
  }
  
  const normalized = dayName.toLowerCase().trim()
  return dayMap[normalized] ?? -1
}

/**
 * Verifica se a loja está aberta no momento atual baseado nos horários de funcionamento
 */
export function isStoreOpen(operatingHours: OperatingHours[], timezone: string = 'America/Sao_Paulo'): {
  isOpen: boolean
  nextOpenTime?: string
  currentDayName?: string
} {
  if (!operatingHours || operatingHours.length === 0) {
    return { isOpen: true } // Se não houver configuração, assume aberto
  }

  // Obtém a data/hora atual no fuso horário especificado
  const now = new Date()
  const currentDayIndex = now.getDay() // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const currentTime = now.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  })

  // Mapeia índice do JavaScript para nome do dia em português
  const dayNamesMap: Record<number, string[]> = {
    0: ['domingo'],
    1: ['segunda', 'segunda-feira'],
    2: ['terça', 'terça-feira'],
    3: ['quarta', 'quarta-feira'],
    4: ['quinta', 'quinta-feira'],
    5: ['sexta', 'sexta-feira'],
    6: ['sábado', 'sabado'],
  }

  const currentDayNames = dayNamesMap[currentDayIndex] || []
  
  // Encontra o horário de funcionamento do dia atual
  const todayHours = operatingHours.find(hour => {
    const hourDayLower = hour.day.toLowerCase()
    return currentDayNames.some(dayName => hourDayLower.includes(dayName))
  })

  if (!todayHours || !todayHours.enabled) {
    // Loja está fechada hoje
    // Encontra o próximo dia aberto
    let nextOpenDay: OperatingHours | null = null
    for (let i = 1; i <= 7; i++) {
      const checkDayIndex = (currentDayIndex + i) % 7
      const checkDayNames = dayNamesMap[checkDayIndex] || []
      const foundDay = operatingHours.find(hour => {
        const hourDayLower = hour.day.toLowerCase()
        return checkDayNames.some(dayName => hourDayLower.includes(dayName)) && hour.enabled
      })
      if (foundDay) {
        nextOpenDay = foundDay
        break
      }
    }

    return {
      isOpen: false,
      nextOpenTime: nextOpenDay ? `${nextOpenDay.day} às ${nextOpenDay.startTime}` : undefined,
      currentDayName: currentDayNames[0],
    }
  }

  // Converte horários para minutos desde meia-noite para comparação
  const [startHour, startMin] = todayHours.startTime.split(':').map(Number)
  const [endHour, endMin] = todayHours.endTime.split(':').map(Number)
  const [currentHour, currentMin] = currentTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  const currentMinutes = currentHour * 60 + currentMin

  // Verifica se está dentro do horário
  const isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes

  if (!isOpen) {
    // Loja está fechada hoje, mas abrirá novamente hoje
    if (currentMinutes < startMinutes) {
      return {
        isOpen: false,
        nextOpenTime: `Hoje às ${todayHours.startTime}`,
        currentDayName: currentDayNames[0],
      }
    } else {
      // Já passou do horário de fechamento, procura próximo dia
      let nextOpenDay: OperatingHours | null = null
      for (let i = 1; i <= 7; i++) {
        const checkDayIndex = (currentDayIndex + i) % 7
        const checkDayNames = dayNamesMap[checkDayIndex] || []
        const foundDay = operatingHours.find(hour => {
          const hourDayLower = hour.day.toLowerCase()
          return checkDayNames.some(dayName => hourDayLower.includes(dayName)) && hour.enabled
        })
        if (foundDay) {
          nextOpenDay = foundDay
          break
        }
      }

      return {
        isOpen: false,
        nextOpenTime: nextOpenDay 
          ? `${nextOpenDay.day} às ${nextOpenDay.startTime}` 
          : undefined,
        currentDayName: currentDayNames[0],
      }
    }
  }

  return { isOpen: true, currentDayName: currentDayNames[0] }
}

/**
 * Obtém o horário de fechamento do dia atual
 */
export function getStoreClosingTime(operatingHours: OperatingHours[], timezone: string = 'America/Sao_Paulo'): string | null {
  if (!operatingHours || operatingHours.length === 0) {
    return null
  }

  const now = new Date()
  const currentDayIndex = now.getDay()
  
  const dayNamesMap: Record<number, string[]> = {
    0: ['domingo'],
    1: ['segunda', 'segunda-feira'],
    2: ['terça', 'terça-feira'],
    3: ['quarta', 'quarta-feira'],
    4: ['quinta', 'quinta-feira'],
    5: ['sexta', 'sexta-feira'],
    6: ['sábado', 'sabado'],
  }

  const currentDayNames = dayNamesMap[currentDayIndex] || []
  const todayHours = operatingHours.find(hour => {
    const hourDayLower = hour.day.toLowerCase()
    return currentDayNames.some(dayName => hourDayLower.includes(dayName)) && hour.enabled
  })

  return todayHours?.endTime || null
}

