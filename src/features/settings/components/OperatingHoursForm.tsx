import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import type { OperatingHours } from '@/types'

interface OperatingHoursFormProps {
  onChanges?: (hasChanges: boolean) => void
}

export interface OperatingHoursFormRef {
  save: () => Promise<void>
}

const defaultDays = [
  { day: 'Segunda-feira', dayKey: 'monday', startTime: '10:00', endTime: '22:00', enabled: true },
  { day: 'Terça-feira', dayKey: 'tuesday', startTime: '10:00', endTime: '22:00', enabled: true },
  { day: 'Quarta-feira', dayKey: 'wednesday', startTime: '10:00', endTime: '22:00', enabled: true },
  { day: 'Quinta-feira', dayKey: 'thursday', startTime: '10:00', endTime: '22:00', enabled: true },
  { day: 'Sexta-feira', dayKey: 'friday', startTime: '10:00', endTime: '22:00', enabled: true },
  { day: 'Sábado', dayKey: 'saturday', startTime: '11:00', endTime: '23:30', enabled: true },
  { day: 'Domingo', dayKey: 'sunday', startTime: '00:00', endTime: '00:00', enabled: false },
]

export const OperatingHoursForm = forwardRef<OperatingHoursFormRef, OperatingHoursFormProps>(
  ({ onChanges }, ref) => {
    const currentTenant = useTenantStore((state) => state.currentTenant)
    const [hours, setHours] = useState<OperatingHours[]>([])
    const [hasChanges, setHasChanges] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Carrega dados salvos
    useEffect(() => {
      if (currentTenant) {
        const settings = getTenantData<{ operatingHours: OperatingHours[] }>(currentTenant.id, 'settings')
        if (settings?.operatingHours && settings.operatingHours.length > 0) {
          const savedDays = settings.operatingHours
          
          // Verifica se já está no formato novo (tem 7 dias)
          const hasAllDays = savedDays.length === 7 && savedDays.every(s => 
            ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
              .some(day => s.day === day)
          )
          
          if (hasAllDays) {
            // Já está no formato novo, apenas ordena
            const orderedDays = defaultDays.map(defaultDay => {
              const savedDay = savedDays.find(s => s.day === defaultDay.day)
              return savedDay || {
                day: defaultDay.day,
                enabled: defaultDay.enabled,
                startTime: defaultDay.startTime,
                endTime: defaultDay.endTime,
              }
            })
            setHours(orderedDays)
          } else {
            // Migra dados antigos para o novo formato com todos os dias
            // Primeiro, verifica se tem entrada "Segunda a Sexta"
            const weekdaysEntry = savedDays.find(s => {
              const dayLower = s.day.toLowerCase()
              return dayLower.includes('segunda') && dayLower.includes('sexta')
            })
            
            const allDays = defaultDays.map(defaultDay => {
              // Se é um dia útil e existe entrada "Segunda a Sexta", usa ela
              if (weekdaysEntry && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(defaultDay.dayKey)) {
                return {
                  day: defaultDay.day,
                  enabled: weekdaysEntry.enabled,
                  startTime: weekdaysEntry.startTime,
                  endTime: weekdaysEntry.endTime,
                }
              }
              
              // Tenta encontrar dia específico salvo (Sábado, Domingo, etc)
              const savedDay = savedDays.find(s => {
                const savedDayLower = s.day.toLowerCase().trim()
                if (savedDayLower.includes('sábado') || savedDayLower.includes('sabado')) {
                  return defaultDay.dayKey === 'saturday'
                }
                if (savedDayLower.includes('domingo')) {
                  return defaultDay.dayKey === 'sunday'
                }
                // Verifica correspondência direta
                return savedDayLower.includes(defaultDay.dayKey) ||
                  defaultDay.day.toLowerCase().includes(savedDayLower.split(' ')[0])
              })
              
              if (savedDay) {
                return {
                  day: defaultDay.day,
                  enabled: savedDay.enabled,
                  startTime: savedDay.startTime,
                  endTime: savedDay.endTime,
                }
              }
              
              // Usa valores padrão
              return {
                day: defaultDay.day,
                enabled: defaultDay.enabled,
                startTime: defaultDay.startTime,
                endTime: defaultDay.endTime,
              }
            })
            
            setHours(allDays)
          }
        } else {
          // Usa valores padrão
          setHours(defaultDays.map(d => ({
            day: d.day,
            enabled: d.enabled,
            startTime: d.startTime,
            endTime: d.endTime,
          })))
        }
      }
    }, [currentTenant])

    // Notifica mudanças
    useEffect(() => {
      onChanges?.(hasChanges)
    }, [hasChanges, onChanges])

    const handleToggle = (index: number) => {
      setHours((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          enabled: !updated[index].enabled,
        }
        setHasChanges(true)
        return updated
      })
    }

    const handleTimeChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
      setHours((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          [field]: value,
        }
        setHasChanges(true)
        return updated
      })
    }

    const save = async () => {
      if (!currentTenant) return

      setIsSaving(true)
      try {
        const settings = getTenantData<{ operatingHours: OperatingHours[] }>(currentTenant.id, 'settings') || {}
        settings.operatingHours = hours
        settings.timezone = 'America/Sao_Paulo' // Fuso horário de Brasília
        setTenantData(currentTenant.id, 'settings', settings)
        
        setHasChanges(false)
      } catch (error) {
        console.error('Erro ao salvar horários:', error)
        throw error
      } finally {
        setIsSaving(false)
      }
    }

    useImperativeHandle(ref, () => ({
      save,
    }))

    if (!currentTenant) {
      return null
    }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Horários de Funcionamento</CardTitle>
          </div>
          <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
            FUSO HORÁRIO: BRASÍLIA
          </div>
        </div>
        <CardDescription>
          Configure os horários de funcionamento da sua açaiteria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {hours.map((dayHours, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 border rounded-lg"
            >
              <div className="flex-1">
                <Label className="text-base font-semibold mb-3 block">
                  {dayHours.day}
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={dayHours.startTime}
                      onChange={(e) => handleTimeChange(index, 'startTime', e.target.value)}
                      disabled={!dayHours.enabled}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">às</span>
                    <Input
                      type="time"
                      value={dayHours.endTime}
                      onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                      disabled={!dayHours.enabled}
                      className="w-32"
                    />
                  </div>
                </div>
              </div>
              <Switch
                checked={dayHours.enabled}
                onCheckedChange={() => handleToggle(index)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})

OperatingHoursForm.displayName = 'OperatingHoursForm'

