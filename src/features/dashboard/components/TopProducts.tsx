import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTopProducts } from '@/lib/api/dashboard'
import { useState, useEffect } from 'react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function TopProducts() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sales: number; revenue: number }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProducts = async () => {
      if (!currentTenant) {
        setTopProducts([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const products = await getTopProducts(currentTenant.id, 5)
        setTopProducts(products)
      } catch (error) {
        console.error('[TopProducts] Erro ao carregar produtos:', error)
        setTopProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    loadProducts()
  }, [currentTenant])

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Produtos Mais Vendidos
        </CardTitle>
        <CardDescription>
          Top 5 produtos por faturamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando dados...
          </div>
        ) : topProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum produto vendido ainda
          </div>
        ) : (
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: `hsl(var(--primary))`,
                      color: `hsl(var(--primary-foreground))`,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {product.sales} venda{product.sales !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(product.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
