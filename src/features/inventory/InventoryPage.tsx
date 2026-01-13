import { useState } from 'react'
import { ProductForm } from './components/ProductForm'
import { ProductList } from './components/ProductList'
import { LowStockAlerts } from './components/LowStockAlerts'

export default function InventoryPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">
            Controle de produtos e ingredientes
          </p>
        </div>
        <ProductForm onSuccess={handleSuccess} />
      </div>

      {/* Alertas de Estoque */}
      <LowStockAlerts />

      {/* Lista de Produtos */}
      <ProductList refreshTrigger={refreshTrigger} />
    </div>
  )
}
