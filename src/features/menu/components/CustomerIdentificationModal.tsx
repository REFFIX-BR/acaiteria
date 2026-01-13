import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatPhoneNumber(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '')
  
  // Aplica a máscara (__) _____-____
  if (numbers.length <= 2) {
    return numbers
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
  } else {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }
}

interface CustomerIdentificationModalProps {
  open: boolean
  onClose: () => void
  onContinue: (customerName: string, customerPhone: string) => void
  primaryColor: string
}

export function CustomerIdentificationModal({
  open,
  onClose,
  onContinue,
  primaryColor,
}: CustomerIdentificationModalProps) {
  const [customerName, setCustomerName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: undefined }))
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerName(e.target.value)
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }))
    }
  }

  const handleContinue = () => {
    const newErrors: { name?: string; phone?: string } = {}

    // Validação do nome
    const nameTrimmed = customerName.trim()
    if (!nameTrimmed) {
      newErrors.name = 'Nome é obrigatório'
    } else if (nameTrimmed.split(' ').length < 2) {
      newErrors.name = 'Informe nome e sobrenome'
    }

    // Validação do telefone
    const phoneNumbers = phoneNumber.replace(/\D/g, '')
    if (!phoneNumbers || phoneNumbers.length < 10) {
      newErrors.phone = 'Telefone inválido'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Remove formatação do telefone para salvar apenas números
    const cleanPhone = phoneNumbers
    onContinue(nameTrimmed, cleanPhone)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f7f6] overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#f8f7f6]/80 backdrop-blur-md px-4 sm:px-10 py-4 sm:py-6 flex items-center justify-between border-b border-[#f3ede7]">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[#9a734c] hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#f3ede7] rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-[#1b140d]" />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar h-[calc(100vh-73px)]">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-[#1b140d]">
              Identifique-se
            </h1>
          </div>

          <div className="space-y-6">
            {/* WhatsApp Number */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-semibold text-[#1b140d]">
                Seu número de WhatsApp é:
              </Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(  ) _____-____"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  className={cn(
                    "w-full h-14 text-lg border-[#9a734c] border-2 rounded-lg px-4 bg-white",
                    "focus:ring-2 focus:ring-offset-0 focus:border-primary",
                    "text-[#1b140d] placeholder:text-[#9a734c]/60",
                    errors.phone ? "border-red-500" : ""
                  )}
                  style={{
                    '--tw-ring-color': primaryColor,
                    borderColor: errors.phone ? '#ef4444' : '#9a734c',
                  } as any}
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-[#1b140d]">
                Seu nome e sobrenome:
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder="Nome e sobrenome"
                  value={customerName}
                  onChange={handleNameChange}
                  className={cn(
                    "w-full h-14 text-lg border-[#9a734c] border-2 rounded-lg px-4 bg-white",
                    "focus:ring-2 focus:ring-offset-0 focus:border-primary",
                    "text-[#1b140d] placeholder:text-[#9a734c]/60",
                    errors.name ? "border-red-500" : ""
                  )}
                  style={{
                    '--tw-ring-color': primaryColor,
                    borderColor: errors.name ? '#ef4444' : '#9a734c',
                  } as any}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Continue Button */}
            <Button
              onClick={handleContinue}
              disabled={!customerName.trim() || !phoneNumber.replace(/\D/g, '').length}
              className={cn(
                "w-full h-14 rounded-lg font-semibold text-base transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:opacity-90"
              )}
              style={{
                backgroundColor: primaryColor,
              }}
            >
              Avançar
            </Button>

            {/* Info Text */}
            <p className="text-sm text-[#9a734c] text-center leading-relaxed">
              Para realizar seu pedido vamos precisar de suas informações, este é um ambiente protegido.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

