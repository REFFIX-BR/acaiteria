import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { useStockControl } from '../hooks/useStockControl'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function LowStockAlerts() {
  const { getLowStockProducts, getCriticalStockProducts } = useStockControl()
  const navigate = useNavigate()

  const lowStock = useMemo(() => getLowStockProducts(), [getLowStockProducts])
  const criticalStock = useMemo(() => getCriticalStockProducts(), [getCriticalStockProducts])

  const allAlerts = useMemo(() => {
    const critical = criticalStock.map((p) => ({ ...p, level: 'critical' as const }))
    const low = lowStock
      .filter((p) => !criticalStock.some((cp) => cp.id === p.id))
      .map((p) => ({ ...p, level: 'low' as const }))
    return [...critical, ...low]
  }, [lowStock, criticalStock])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Alertas de Estoque
        </CardTitle>
        <CardDescription>
          Produtos que precisam de reposição
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Todos os produtos estão com estoque adequado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allAlerts.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  product.level === 'critical'
                    ? 'border-destructive/30 bg-destructive/10'
                    : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20'
                }`}
              >
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Estoque: {product.currentStock} {product.unit} • Mínimo: {product.minStock} {product.unit}
                  </div>
                </div>
                <div
                  className={`font-semibold text-sm ${
                    product.level === 'critical' ? 'text-destructive' : 'text-orange-600'
                  }`}
                >
                  {product.level === 'critical' ? 'Crítico' : 'Baixo'}
                </div>
              </div>
            ))}
            {allAlerts.length > 5 && (
              <div className="pt-2 text-sm text-muted-foreground text-center">
                +{allAlerts.length - 5} produto(s) com estoque baixo
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

