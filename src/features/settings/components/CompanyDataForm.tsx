import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import type { CompanySettings } from '@/types'

const companySchema = z.object({
  tradeName: z.string().optional(),
  contactPhone: z.string().optional(),
  cnpj: z.string().optional(), // Aceita CPF ou CNPJ
  adminEmail: z.string().optional().refine(
    (val) => {
      // Se vazio ou undefined, é válido (campo opcional)
      if (!val || val.trim() === '') return true
      // Se preenchido, valida formato de email
      return z.string().email().safeParse(val).success
    },
    { message: 'E-mail inválido' }
  ),
})

type CompanyFormData = z.infer<typeof companySchema>

interface CompanyDataFormProps {
  onChanges?: (hasChanges: boolean) => void
}

export interface CompanyDataFormRef {
  save: () => Promise<void>
}

export const CompanyDataForm = forwardRef<CompanyDataFormRef, CompanyDataFormProps>(
  ({ onChanges }, ref) => {
    const currentTenant = useTenantStore((state) => state.currentTenant)
    const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    trigger,
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      tradeName: '',
      contactPhone: '',
      cnpj: '',
      adminEmail: '',
    },
  })

  // Carrega dados salvos do backend
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentTenant) return

      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (!token) return

        const response = await fetch(`${apiUrl}/api/settings/company`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.settings) {
            reset({
              tradeName: data.settings.trade_name || '',
              contactPhone: data.settings.contact_phone || '',
              cnpj: data.settings.cnpj || '',
              adminEmail: data.settings.admin_email || '',
            })
          }
        }
      } catch (error) {
        console.error('[CompanyDataForm] Erro ao carregar configurações:', error)
      }
    }

    loadSettings()
  }, [currentTenant, reset])

  // Notifica mudanças
  useEffect(() => {
    onChanges?.(isDirty)
  }, [isDirty, onChanges])

  const save = async () => {
    if (!currentTenant) return

    const data = watch()
    const isValid = await trigger()
    
    if (!isValid) {
      throw new Error('Formulário inválido')
    }

    setIsSaving(true)
    try {
      const { getApiUrl } = await import('@/lib/api/config')
      const { getAuthToken } = await import('@/lib/api/auth')
      const apiUrl = getApiUrl()
      const token = getAuthToken()

      if (!token) {
        throw new Error('Token de autenticação não encontrado')
      }

      const response = await fetch(`${apiUrl}/api/settings/company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tradeName: data.tradeName,
          contactPhone: data.contactPhone,
          cnpj: data.cnpj,
          adminEmail: data.adminEmail,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao salvar configurações')
      }

      reset(data, { keepValues: true })
      onChanges?.(false)
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({
    save,
  }))

  const onSubmit = async (data: CompanyFormData) => {
    await save()
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Dados da Empresa</CardTitle>
        </div>
        <CardDescription>
          Informações básicas da sua açaiteria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tradeName">NOME FANTASIA</Label>
              <Input
                id="tradeName"
                placeholder="Ex: Açaiteria Premium Centro"
                {...register('tradeName')}
              />
              {errors.tradeName && (
                <p className="text-sm text-destructive">{errors.tradeName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CPF / CNPJ (OPCIONAL)</Label>
              <Input
                id="cnpj"
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                {...register('cnpj')}
              />
              {errors.cnpj && (
                <p className="text-sm text-destructive">{errors.cnpj.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">TELEFONE DE CONTATO</Label>
              <Input
                id="contactPhone"
                placeholder="(11) 99999-0000"
                {...register('contactPhone')}
              />
              {errors.contactPhone && (
                <p className="text-sm text-destructive">{errors.contactPhone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">E-MAIL ADMINISTRATIVO</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="contato@acaiteria.com"
                {...register('adminEmail')}
              />
              {errors.adminEmail && (
                <p className="text-sm text-destructive">{errors.adminEmail.message}</p>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
})

CompanyDataForm.displayName = 'CompanyDataForm'

