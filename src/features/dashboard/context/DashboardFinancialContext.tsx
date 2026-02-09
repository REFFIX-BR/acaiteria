import { createContext, useContext, useState, useEffect } from 'react'
import { getFinancialSummaryPasswordStatus } from '@/lib/api/settings'
import { setFinancialSummaryPassword, verifyFinancialSummaryPassword } from '@/lib/api/settings'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DashboardFinancialContextValue {
  hasPassword: boolean | null
  unlocked: boolean
  setHasPassword: (v: boolean) => void
  setUnlocked: (v: boolean) => void
  openSetModal: () => void
  openVerifyModal: () => void
}

const DashboardFinancialContext = createContext<DashboardFinancialContextValue | null>(null)

export function DashboardFinancialProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast()
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [showSetModal, setShowSetModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifyPassword, setVerifyPassword] = useState('')
  const [setSubmitting, setSetSubmitting] = useState(false)
  const [verifySubmitting, setVerifySubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    getFinancialSummaryPasswordStatus()
      .then(({ hasPassword: hp }) => {
        if (!cancelled) {
          setHasPassword(hp)
          if (!hp) setUnlocked(false)
        }
      })
      .catch(() => {
        if (!cancelled) setHasPassword(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleSetPassword = async () => {
    if (!newPassword.trim() || newPassword !== confirmPassword) {
      toast({ title: 'Erro', description: 'Preencha e confirme a senha.', variant: 'destructive' })
      return
    }
    setSetSubmitting(true)
    try {
      const result = await setFinancialSummaryPassword(newPassword, confirmPassword)
      if (result.success) {
        setHasPassword(true)
        setUnlocked(true)
        setShowSetModal(false)
        setNewPassword('')
        setConfirmPassword('')
        toast({ title: 'Senha definida', description: 'Valores financeiros protegidos. Use o ícone do olho para visualizar.' })
      } else {
        toast({ title: 'Erro', description: result.error || 'Não foi possível definir a senha.', variant: 'destructive' })
      }
    } finally {
      setSetSubmitting(false)
    }
  }

  const handleVerifyPassword = async () => {
    if (!verifyPassword.trim()) {
      toast({ title: 'Erro', description: 'Digite a senha.', variant: 'destructive' })
      return
    }
    setVerifySubmitting(true)
    try {
      const result = await verifyFinancialSummaryPassword(verifyPassword)
      if (result.valid) {
        setUnlocked(true)
        setShowVerifyModal(false)
        setVerifyPassword('')
      } else {
        toast({ title: 'Senha incorreta', description: 'Tente novamente.', variant: 'destructive' })
      }
    } finally {
      setVerifySubmitting(false)
    }
  }

  const value: DashboardFinancialContextValue = {
    hasPassword,
    unlocked,
    setHasPassword,
    setUnlocked,
    openSetModal: () => setShowSetModal(true),
    openVerifyModal: () => {
      setVerifyPassword('')
      setShowVerifyModal(true)
    },
  }

  return (
    <DashboardFinancialContext.Provider value={value}>
      {children}
      <Dialog open={showSetModal} onOpenChange={setShowSetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir senha dos valores financeiros</DialogTitle>
            <DialogDescription>
              Quem não souber esta senha não poderá ver valores no Dashboard nem no Fluxo de Caixa. Defina uma senha para proteger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ctx-new-password">Nova senha</Label>
              <Input
                id="ctx-new-password"
                type="password"
                placeholder="Mínimo 4 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctx-confirm-password">Confirmar senha</Label>
              <Input
                id="ctx-confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowSetModal(false)}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={setSubmitting}>
              {setSubmitting ? 'Salvando...' : 'Definir senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visualizar valores financeiros</DialogTitle>
            <DialogDescription>
              Digite a senha configurada pelo administrador para ver os valores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ctx-verify-password">Senha</Label>
              <Input
                id="ctx-verify-password"
                type="password"
                placeholder="Digite a senha"
                value={verifyPassword}
                onChange={(e) => setVerifyPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowVerifyModal(false)}>Cancelar</Button>
            <Button onClick={handleVerifyPassword} disabled={verifySubmitting}>
              {verifySubmitting ? 'Verificando...' : 'Visualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardFinancialContext.Provider>
  )
}

export function useDashboardFinancial() {
  const ctx = useContext(DashboardFinancialContext)
  if (!ctx) return null
  return ctx
}

/** true = deve ocultar valores (tem senha e não está desbloqueado) */
export function useFinancialLocked(): boolean {
  const ctx = useDashboardFinancial()
  if (!ctx) return false
  return ctx.hasPassword === true && !ctx.unlocked
}
