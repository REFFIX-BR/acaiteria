import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/hooks/use-theme'
import { getAuthToken } from '@/lib/api/auth'

// Auth
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import OnboardingPage from '@/features/auth/OnboardingPage'

// Dashboard
import DashboardPage from '@/features/dashboard/DashboardPage'
import CashflowPage from '@/features/cashflow/CashflowPage'
import MenuEditorPage from '@/features/menu/MenuEditorPage'
import MenuPublicPage from '@/features/menu/MenuPublicPage'
import MenuSettingsPage from '@/features/menu/MenuSettingsPage'
import OrdersPage from '@/features/orders/OrdersPage'
import CounterMenuPage from '@/features/orders/CounterMenuPage'
import MarketingPage from '@/features/marketing/MarketingPage'
import WhatsAppPage from '@/features/whatsapp/WhatsAppPage'
import SettingsPage from '@/features/settings/SettingsPage'
import PlansPage from '@/features/subscription/PlansPage'
import DeliveryFeesPage from '@/features/delivery-fees/DeliveryFeesPage'
import { SubscriptionGuard } from '@/components/SubscriptionGuard'

// Layout
import MainLayout from '@/components/layout/MainLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { loadTenant, isLoading } = useTenantStore()

  // Carregar tenant do backend quando usuário está autenticado mas tenant não está carregado
  useEffect(() => {
    if (currentUser && !currentTenant && !isLoading) {
      const token = getAuthToken()
      if (token && currentUser.tenantId) {
        loadTenant(currentUser.tenantId)
      }
    }
  }, [currentUser, currentTenant, isLoading, loadTenant])

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // Aguardar carregamento do tenant
  if (!currentTenant && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!currentTenant) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  // Inicializa o tema
  useTheme()

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/menu/:tenantSlug" element={<MenuPublicPage />} />

          {/* Rotas protegidas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <DashboardPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashflow"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <CashflowPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <MenuEditorPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu-settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <MenuSettingsPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <OrdersPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/counter-menu"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <CounterMenuPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketing"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <MarketingPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <WhatsAppPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/delivery-fees"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <DeliveryFeesPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <SettingsPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard showUpgradePrompt={false}>
                    <PlansPage />
                  </SubscriptionGuard>
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Rota padrão */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

