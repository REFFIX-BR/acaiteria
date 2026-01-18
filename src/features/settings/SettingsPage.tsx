import { useState, useRef } from 'react'
import { CompanyDataForm, type CompanyDataFormRef } from './components/CompanyDataForm'
import { OperatingHoursForm, type OperatingHoursFormRef } from './components/OperatingHoursForm'
import { LogoUploadForm, type LogoUploadFormRef } from './components/LogoUploadForm'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Save, X } from 'lucide-react'

export default function SettingsPage() {
  const { toast } = useToast()
  const [hasChanges, setHasChanges] = useState(false)
  const companyFormRef = useRef<CompanyDataFormRef>(null)
  const hoursFormRef = useRef<OperatingHoursFormRef>(null)
  const logoFormRef = useRef<LogoUploadFormRef>(null)

  const handleSave = async () => {
    const errors: string[] = []
    const successes: string[] = []

    // Salva cada formulário independentemente
    try {
      await companyFormRef.current?.save()
      successes.push('Dados da empresa')
    } catch (error) {
      console.error('Erro ao salvar dados da empresa:', error)
      errors.push('Dados da empresa')
    }

    try {
      await hoursFormRef.current?.save()
      successes.push('Horários de funcionamento')
    } catch (error) {
      console.error('Erro ao salvar horários:', error)
      errors.push('Horários de funcionamento')
    }

    try {
      await logoFormRef.current?.save()
      successes.push('Logo')
    } catch (error) {
      console.error('Erro ao salvar logo:', error)
      errors.push('Logo')
    }

    // Se pelo menos um foi salvo com sucesso, considera sucesso parcial
    if (successes.length > 0) {
      setHasChanges(false)
      if (errors.length === 0) {
        toast({
          title: 'Sucesso',
          description: 'Todas as configurações foram salvas com sucesso',
        })
      } else {
        toast({
          title: 'Salvo parcialmente',
          description: `Salvo: ${successes.join(', ')}. Erro: ${errors.join(', ')}`,
          variant: 'default',
        })
      }
    } else if (errors.length > 0) {
      toast({
        title: 'Erro',
        description: `Não foi possível salvar: ${errors.join(', ')}`,
        variant: 'destructive',
      })
    }
  }

  const handleDiscard = () => {
    setHasChanges(false)
    toast({
      title: 'Alterações descartadas',
      description: 'As alterações não salvas foram descartadas',
    })
    // Recarrega a página para resetar os formulários
    window.location.reload()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie os dados da sua unidade e parâmetros técnicos do sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={!hasChanges}
          >
            <X className="h-4 w-4 mr-2" />
            Descartar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Forms */}
      <LogoUploadForm ref={logoFormRef} onChanges={setHasChanges} />
      <CompanyDataForm ref={companyFormRef} onChanges={setHasChanges} />
      <OperatingHoursForm ref={hoursFormRef} onChanges={setHasChanges} />
    </div>
  )
}

