import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import { authenticateUser, getUserByEmail, getAllUsers, hashPasswordForStorage } from '@/lib/auth/auth'
import { getTenantById, saveTenant, setGlobalData } from '@/lib/storage/storage'
import { getApiUrl } from '@/lib/api/config'
import { createInitialSubscription } from '@/lib/subscription/subscription'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ChefHat, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { setUser } = useAuthStore()
  const { setTenant } = useTenantStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    
    try {
      // Primeiro, tenta fazer login no backend para obter o token JWT
      const apiUrl = getApiUrl()
      let backendToken: string | null = null
      let backendUser: any = null

      try {
        const response = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
          }),
        })

        if (response.ok) {
          const result = await response.json()
          backendToken = result.token
          backendUser = result.user
          
          // Salva o token JWT no localStorage
          if (backendToken) {
            localStorage.setItem('auth_token', backendToken)
            console.log('[Login] Token JWT salvo com sucesso')
          }
          
          // Se login no backend foi bem-sucedido, usar dados do backend
          // Verificar se tenant existe localmente, se não, criar
          let tenant = getTenantById(backendUser.tenantId)
          if (!tenant) {
            tenant = {
              id: backendUser.tenantId,
              name: backendUser.tenantName,
              slug: backendUser.tenantSlug,
              primaryColor: '#8b5cf6',
              secondaryColor: '#ec4899',
              createdAt: new Date(),
              subscription: createInitialSubscription(new Date()),
            }
            saveTenant(tenant)
          }
          
          // Verificar se usuário já existe localmente, se não, criar
          let user = getUserByEmail(backendUser.email)
          
          if (!user) {
            // Criar usuário local (senha placeholder, não será usada)
            const users = getAllUsers()
            user = {
              id: backendUser.id,
              email: backendUser.email,
              password: hashPasswordForStorage('backend-auth'), // Placeholder
              name: backendUser.name,
              tenantId: backendUser.tenantId,
              role: backendUser.role,
              createdAt: new Date(),
            }
            users.push(user)
            setGlobalData('users', users)
          } else {
            // Atualizar dados do usuário existente com dados do backend
            user = {
              ...user,
              id: backendUser.id,
              name: backendUser.name,
              tenantId: backendUser.tenantId,
              role: backendUser.role,
            }
            const users = getAllUsers()
            const userIndex = users.findIndex(u => u.email === backendUser.email)
            if (userIndex !== -1) {
              users[userIndex] = user
              setGlobalData('users', users)
            }
          }
          
          const userWithBackendId = user
          
          // Definir usuário e tenant
          setUser(userWithBackendId)
          setTenant(tenant)
          
          toast({
            title: 'Bem-vindo!',
            description: `Olá, ${backendUser.name}!`,
          })
          
          navigate('/dashboard')
          setIsLoading(false)
          return
        } else if (response.status === 401) {
          // Credenciais inválidas no backend - não usar fallback local
          const errorData = await response.json().catch(() => ({}))
          console.error('[Login] Credenciais inválidas no backend:', errorData)
          toast({
            title: 'Erro ao fazer login',
            description: 'E-mail ou senha incorretos. Verifique suas credenciais.',
            variant: 'destructive',
          })
          setIsLoading(false)
          return
        } else if (response.status === 404) {
          console.error('[Login] Backend não encontrado (404). Verifique se a API está acessível em:', `${apiUrl}/api/auth/login`)
          // Continua com autenticação local apenas se backend não estiver disponível
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.warn('[Login] Falha ao fazer login no backend:', response.status, errorData)
          // Se for erro do servidor (500, etc), não usar fallback
          if (response.status >= 500) {
            toast({
              title: 'Erro no servidor',
              description: 'O servidor está com problemas. Tente novamente mais tarde.',
              variant: 'destructive',
            })
            setIsLoading(false)
            return
          }
        }
      } catch (error: any) {
        console.error('[Login] Erro ao conectar com backend:', error.message)
        // Se for erro de rede (CORS, DNS, etc), mostra aviso mas continua com fallback
        if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_NAME_NOT_RESOLVED')) {
          console.warn('[Login] Não foi possível conectar ao backend. Continuando com autenticação local.')
        } else {
          // Outros erros não devem usar fallback
          toast({
            title: 'Erro de conexão',
            description: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
            variant: 'destructive',
          })
          setIsLoading(false)
          return
        }
      }

      // Autenticação local (fallback APENAS se backend não estiver disponível)
      // Se chegou aqui, o backend não respondeu ou retornou 404
      const user = authenticateUser(data.email, data.password)
      
      if (!user) {
        toast({
          title: 'Erro ao fazer login',
          description: 'E-mail ou senha incorretos',
          variant: 'destructive',
        })
        return
      }

      // Carrega o tenant do usuário
      const tenant = getTenantById(user.tenantId)
      if (!tenant) {
        toast({
          title: 'Erro',
          description: 'Tenant não encontrado',
          variant: 'destructive',
        })
        return
      }

      // Define usuário e tenant
      setUser(user)
      setTenant({
        ...tenant,
        createdAt: tenant.createdAt instanceof Date ? tenant.createdAt : new Date(tenant.createdAt),
      })

      toast({
        title: 'Bem-vindo!',
        description: `Olá, ${user.name}!`,
      })

      navigate('/dashboard')
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao fazer login. Tente novamente.',
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
              <CardTitle className="text-3xl font-bold">Bem-vindo</CardTitle>
              <CardDescription className="text-base mt-2">
                Faça login para acessar sua açaiteria
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Não tem uma conta?{' '}
                <Link
                  to="/register"
                  className="text-primary hover:underline font-medium"
                >
                  Criar conta
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
