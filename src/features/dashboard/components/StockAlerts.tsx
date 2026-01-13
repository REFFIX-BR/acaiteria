import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { getLowStockProducts } from '@/lib/api/dashboard'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function StockAlerts() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const navigate = useNavigate()

  const lowStockProducts = useMemo(() => {
    if (!currentTenant) return []
    return getLowStockProducts(currentTenant.id)
  }, [currentTenant])

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Alertas de Estoque
        </CardTitle>
        <CardDescription>
          Produtos com estoque baixo
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lowStockProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Todos os produtos estão com estoque adequado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lowStockProducts.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5"
              >
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Estoque: {product.currentStock} {product.unit} • Mínimo: {product.minStock} {product.unit}
                  </div>
                </div>
                <div className="text-destructive font-semibold text-sm">
                  Crítico
                </div>
              </div>
            ))}
            {lowStockProducts.length > 5 && (
              <div className="pt-2 text-sm text-muted-foreground text-center">
                +{lowStockProducts.length - 5} produto(s) com estoque baixo
              </div>
            )}
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => navigate('/inventory')}
            >
              Ver Estoque Completo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

