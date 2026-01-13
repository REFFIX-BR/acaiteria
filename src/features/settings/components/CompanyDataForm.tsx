import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import type { CompanySettings } from '@/types'

const companySchema = z.object({
  tradeName: z.string().min(1, 'Nome fantasia é obrigatório'),
  contactPhone: z.string().min(1, 'Telefone é obrigatório'),
  cnpj: z.string().min(1, 'CNPJ/Identificação é obrigatório'),
  adminEmail: z.string().email('E-mail inválido'),
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

  // Carrega dados salvos
  useEffect(() => {
    if (currentTenant) {
      const settings = getTenantData<{ company: CompanySettings }>(currentTenant.id, 'settings')
      if (settings?.company) {
        reset(settings.company)
      }
    }
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
      const settings = getTenantData<{ company: CompanySettings }>(currentTenant.id, 'settings') || {}
      settings.company = data
      setTenantData(currentTenant.id, 'settings', settings)
      
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
              <Label htmlFor="cnpj">CNPJ / IDENTIFICAÇÃO</Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0001-00"
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

