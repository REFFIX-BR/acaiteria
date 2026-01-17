import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
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

    // Carrega dados salvos do backend
    useEffect(() => {
      const loadSettings = async () => {
        if (!currentTenant) return

        try {
          const { getApiUrl } = await import('@/lib/api/config')
          const { getAuthToken } = await import('@/lib/api/auth')
          const apiUrl = getApiUrl()
          const token = getAuthToken()

          if (!token) {
            setHours(defaultDays.map(d => ({
              day: d.day,
              enabled: d.enabled,
              startTime: d.startTime,
              endTime: d.endTime,
            })))
            return
          }

          const response = await fetch(`${apiUrl}/api/settings/operating-hours`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            const savedHours = data.hours || []
            
            if (savedHours.length > 0) {
              // Mapeia os horários do backend para o formato esperado
              const mappedHours = defaultDays.map(defaultDay => {
                const savedDay = savedHours.find((s: any) => {
                  const savedDayLower = (s.day || '').toLowerCase().trim()
                  const defaultDayLower = defaultDay.day.toLowerCase()
                  return savedDayLower.includes(defaultDayLower.split('-')[0]) || 
                         defaultDayLower.includes(savedDayLower.split(' ')[0])
                })
                
                return savedDay ? {
                  day: defaultDay.day,
                  enabled: savedDay.enabled ?? defaultDay.enabled,
                  startTime: savedDay.start_time || savedDay.startTime || defaultDay.startTime,
                  endTime: savedDay.end_time || savedDay.endTime || defaultDay.endTime,
                } : {
                  day: defaultDay.day,
                  enabled: defaultDay.enabled,
                  startTime: defaultDay.startTime,
                  endTime: defaultDay.endTime,
                }
              })
              
              setHours(mappedHours)
            } else {
              // Usa valores padrão
              setHours(defaultDays.map(d => ({
                day: d.day,
                enabled: d.enabled,
                startTime: d.startTime,
                endTime: d.endTime,
              })))
            }
          } else {
            // Usa valores padrão se não conseguir carregar
            setHours(defaultDays.map(d => ({
              day: d.day,
              enabled: d.enabled,
              startTime: d.startTime,
              endTime: d.endTime,
            })))
          }
        } catch (error) {
          console.error('[OperatingHoursForm] Erro ao carregar horários:', error)
          setHours(defaultDays.map(d => ({
            day: d.day,
            enabled: d.enabled,
            startTime: d.startTime,
            endTime: d.endTime,
          })))
        }
      }

      loadSettings()
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
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (!token) {
          throw new Error('Token de autenticação não encontrado')
        }

        const response = await fetch(`${apiUrl}/api/settings/operating-hours`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(hours),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Erro ao salvar horários')
        }

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

