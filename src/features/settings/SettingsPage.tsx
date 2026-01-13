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
    try {
      // Salva todos os formulários
      await Promise.all([
        companyFormRef.current?.save(),
        hoursFormRef.current?.save(),
        logoFormRef.current?.save(),
      ])
      
      setHasChanges(false)
      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso',
      })
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar configurações',
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

