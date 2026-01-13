import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/hooks/use-theme'

// Auth
import LoginPage from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'
import OnboardingPage from '@/features/auth/OnboardingPage'

// Dashboard
import DashboardPage from '@/features/dashboard/DashboardPage'
import CashflowPage from '@/features/cashflow/CashflowPage'
import InventoryPage from '@/features/inventory/InventoryPage'
import MenuEditorPage from '@/features/menu/MenuEditorPage'
import MenuPublicPage from '@/features/menu/MenuPublicPage'
import MenuSettingsPage from '@/features/menu/MenuSettingsPage'
import OrdersPage from '@/features/orders/OrdersPage'
import CounterMenuPage from '@/features/orders/CounterMenuPage'
import MarketingPage from '@/features/marketing/MarketingPage'
import WhatsAppPage from '@/features/whatsapp/WhatsAppPage'
import SettingsPage from '@/features/settings/SettingsPage'
import PlansPage from '@/features/subscription/PlansPage'
import { SubscriptionGuard } from '@/components/SubscriptionGuard'

// Layout
import MainLayout from '@/components/layout/MainLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const currentTenant = useTenantStore((state) => state.currentTenant)

  if (!currentUser) {
    return <Navigate to="/login" replace />
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
            path="/inventory"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubscriptionGuard>
                    <InventoryPage />
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
            path="/settings"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SettingsPage />
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

