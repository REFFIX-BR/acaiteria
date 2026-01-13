import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import { createUser } from '@/lib/auth/auth'
import { getAllTenants, saveTenant } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ChefHat, Mail, Lock, User, Store, Loader2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WelcomeModal } from '@/components/WelcomeModal'
import type { Tenant } from '@/types'
import { createInitialSubscription } from '@/lib/subscription/subscription'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
  tenantName: z.string().min(2, 'Nome da açaiteria é obrigatório'),
  tenantSlug: z.string().min(2, 'Slug é obrigatório'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { setUser } = useAuthStore()
  const { setTenant } = useTenantStore()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const tenantSlug = watch('tenantSlug')

  // Auto-gera slug baseado no nome da açaiteria
  const handleTenantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setValue('tenantName', name)
    if (!tenantSlug || tenantSlug === '') {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      setValue('tenantSlug', slug)
    }
  }

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)

    try {
      const tenants = getAllTenants()
      
      // Verifica se slug já existe
      const existingTenant = tenants.find(t => t.slug === data.tenantSlug.toLowerCase())
      if (existingTenant) {
        toast({
          title: 'Erro',
          description: 'Este slug já está em uso. Escolha outro.',
          variant: 'destructive',
        })
        setIsLoading(false)
        return
      }

      // Cria novo tenant (açaiteria)
      const createdAt = new Date()
      const tenant: Tenant = {
        id: `tenant-${Date.now()}`,
        name: data.tenantName,
        slug: data.tenantSlug.toLowerCase().replace(/\s+/g, '-'),
        primaryColor: '#8b5cf6',
        secondaryColor: '#ec4899',
        createdAt,
        subscription: createInitialSubscription(createdAt),
      }
      saveTenant(tenant)

      // Cria usuário
      const user = createUser({
        email: data.email,
        password: data.password,
        name: data.name,
        tenantId: tenant.id,
        role: 'owner',
      })

      // Define usuário e tenant
      setUser(user)
      setTenant(tenant)
      setNewUserName(user.name)

      // Mostra modal de boas-vindas
      setShowWelcomeModal(true)
    } catch (error: any) {
      console.error('Erro ao criar conta:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar conta. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ChefHat className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold">Criar Conta</CardTitle>
              <CardDescription className="text-base mt-2">
                Crie sua conta e comece a gerenciar sua açaiteria
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    className={cn(
                      "pl-10",
                      errors.name && "border-destructive"
                    )}
                    {...register('name')}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className={cn(
                      "pl-10",
                      errors.email && "border-destructive"
                    )}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={cn(
                      "pl-10 pr-10",
                      errors.password && "border-destructive"
                    )}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={cn(
                      "pl-10 pr-10",
                      errors.confirmPassword && "border-destructive"
                    )}
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantName">Nome da Açaiteria</Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="tenantName"
                    placeholder="Ex: Açaí Bom Sabor"
                    className={cn(
                      "pl-10",
                      errors.tenantName && "border-destructive"
                    )}
                    {...register('tenantName')}
                    onChange={handleTenantNameChange}
                  />
                </div>
                {errors.tenantName && (
                  <p className="text-sm text-destructive">{errors.tenantName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantSlug">Slug (identificador único)</Label>
                <Input
                  id="tenantSlug"
                  placeholder="Ex: acai-bom-sabor"
                  className={cn(
                    errors.tenantSlug && "border-destructive"
                  )}
                  {...register('tenantSlug')}
                />
                {errors.tenantSlug && (
                  <p className="text-sm text-destructive">{errors.tenantSlug.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Usado no link público do cardápio
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar Conta'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <Link
                  to="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Fazer login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => {
          setShowWelcomeModal(false)
          navigate('/dashboard')
        }}
        userName={newUserName}
      />
    </div>
  )
}

