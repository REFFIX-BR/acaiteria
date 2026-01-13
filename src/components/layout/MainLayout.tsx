import { NavLink } from 'react-router-dom'
import { useTenantStore } from '@/stores/tenantStore'
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Utensils,
  Megaphone,
  MessageCircle,
  Menu as MenuIcon,
  X,
  Sparkles,
  Settings,
  LogOut,
  User as UserIcon,
  Eye,
  ShoppingBag,
  Store,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuthStore } from '@/stores/authStore'
import { getTenantData } from '@/lib/storage/storage'
import type { Order } from '@/types'
import { getPlanInfo } from '@/lib/subscription/subscription'
import { Crown, AlertCircle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type React from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-blue-600' },
  { name: 'Pedidos', href: '/orders', icon: ShoppingBag, color: 'from-purple-500 to-purple-600' },
  { name: 'Cardápio Balcão', href: '/counter-menu', icon: Store, color: 'from-indigo-500 to-indigo-600' },
  { name: 'Fluxo de Caixa', href: '/cashflow', icon: TrendingUp, color: 'from-green-500 to-green-600' },
  { name: 'Estoque', href: '/inventory', icon: Package, color: 'from-orange-500 to-orange-600' },
  { name: 'Cardápio', href: '/menu', icon: Utensils, color: 'from-indigo-500 to-indigo-600' },
  { name: 'Config. Cardápio', href: '/menu-settings', icon: Eye, color: 'from-purple-500 to-purple-600' },
  { name: 'Marketing', href: '/marketing', icon: Megaphone, color: 'from-red-500 to-red-600' },
  { name: 'WhatsApp', href: '/whatsapp', icon: MessageCircle, color: 'from-emerald-500 to-emerald-600' },
  { name: 'Configurações', href: '/settings', icon: Settings, color: 'from-slate-500 to-slate-600' },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const currentUser = useAuthStore((state) => state.currentUser)
  const { logout } = useAuthStore()
  const { clearTenant } = useTenantStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Atualiza contador de pedidos pendentes em tempo real
  useEffect(() => {
    if (!currentTenant) return

    const updatePendingCount = () => {
      const orders = getTenantData<Order[]>(currentTenant.id, 'orders') || []
      const pending = orders.filter((o) => o.status === 'pending').length
      setPendingOrdersCount(pending)
    }

    updatePendingCount()
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1)
      updatePendingCount()
    }, 2000)

    return () => clearInterval(interval)
  }, [currentTenant, refreshTrigger])

  const handleLogout = () => {
    logout()
    clearTenant()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform glass-effect border-r shadow-2xl transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header do Sidebar */}
          <div className="flex h-20 items-center justify-between border-b px-6 bg-card">
            <div className="flex items-center gap-3">
              {currentTenant?.logo ? (
                <div className="relative">
                  <img
                    src={currentTenant.logo}
                    alt={currentTenant.name}
                    className="h-12 w-12 rounded-xl shadow-md ring-2 ring-border"
                  />
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-card animate-pulse" />
                </div>
              ) : (
                <div
                  className="h-12 w-12 rounded-xl shadow-md flex items-center justify-center text-white font-bold text-xl ring-2 ring-border"
                  style={{ 
                    background: currentTenant?.primaryColor 
                      ? `linear-gradient(135deg, ${currentTenant.primaryColor}, ${currentTenant.secondaryColor})`
                      : 'linear-gradient(135deg, #3b82f6, #2563eb)'
                  }}
                >
                  {currentTenant?.name?.[0]?.toUpperCase() || 'A'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-bold text-lg truncate">
                  {currentTenant?.name || 'Açaiteria'}
                </span>
                <span className="text-xs text-muted-foreground">Painel Administrativo</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Banner de Status do Plano */}
          {currentTenant && (() => {
            const planInfo = getPlanInfo(currentTenant)
            if (planInfo.isExpired || planInfo.isTrial) {
              return (
                <div className="mx-4 mt-4 mb-2">
                  <Card className={planInfo.isExpired ? 'border-destructive bg-destructive/10' : 'border-orange-500/50 bg-orange-500/10'}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={planInfo.isExpired ? 'text-destructive' : 'text-orange-500'}>
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold mb-1">
                            {planInfo.isExpired ? 'Trial Expirado' : `Trial: ${planInfo.daysRemaining} ${planInfo.daysRemaining === 1 ? 'dia' : 'dias'}`}
                          </p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {planInfo.isExpired 
                              ? 'Faça upgrade para continuar' 
                              : 'Faça upgrade para continuar após o trial'}
                          </p>
                          <Button
                            size="sm"
                            variant={planInfo.isExpired ? 'destructive' : 'default'}
                            className="w-full"
                            onClick={() => {
                              navigate('/plans')
                              setSidebarOpen(false)
                            }}
                          >
                            <Crown className="h-3 w-3 mr-1" />
                            Ver Planos
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            }
            return null
          })()}

          {/* Navigation */}
          <nav className="flex-1 space-y-2 px-4 py-6 overflow-y-auto">
            {navigation.map((item, index) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  end
                  style={{ animationDelay: `${index * 50}ms` }}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 animate-slide-up',
                      isActive
                        ? 'bg-gradient-to-r shadow-lg shadow-purple-500/20 text-white scale-105'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground hover:scale-102'
                    )
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    'group-hover:scale-110',
                    'bg-gradient-to-br',
                    item.color
                  )}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {item.name === 'Dashboard' && (
                    <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse" />
                  )}
                  {item.name === 'Pedidos' && pendingOrdersCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      {pendingOrdersCount > 9 ? '9+' : pendingOrdersCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Footer do Sidebar */}
          <div className="border-t p-4 bg-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span>Sistema Online</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Plataforma Açaiteria v1.0
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground">Sistema Ativo</span>
            </div>
            <ThemeToggle />
            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}

