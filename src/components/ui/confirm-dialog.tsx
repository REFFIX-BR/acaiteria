import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Confirmar ação',
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant === 'destructive' && (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hook para usar o dialog de confirmação de forma mais fácil
export function useConfirmDialog() {
  const [open, setOpen] = React.useState(false)
  const [config, setConfig] = React.useState<{
    title?: string
    description: string
    confirmText?: string
    cancelText?: string
    variant?: 'default' | 'destructive'
    onConfirm: () => void
  } | null>(null)

  const confirm = React.useCallback(
    (
      description: string,
      onConfirm: () => void,
      options?: {
        title?: string
        confirmText?: string
        cancelText?: string
        variant?: 'default' | 'destructive'
      }
    ) => {
      setConfig({
        description,
        onConfirm,
        title: options?.title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        variant: options?.variant || 'default',
      })
      setOpen(true)
    },
    []
  )

  const ConfirmDialogComponent = config ? (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={config.title}
      description={config.description}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      variant={config.variant}
      onConfirm={config.onConfirm}
    />
  ) : null

  return { confirm, ConfirmDialogComponent }
}

