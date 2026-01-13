import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import type { Product } from '@/types'

/**
 * Hook para controle de estoque
 */
export function useStockControl() {
  const currentTenant = useTenantStore((state) => state.currentTenant)

  const getProducts = (): Product[] => {
    if (!currentTenant) return []
    return getTenantData<Product[]>(currentTenant.id, 'products') || []
  }

  const saveProducts = (products: Product[]): void => {
    if (!currentTenant) return
    setTenantData(currentTenant.id, 'products', products)
  }

  const getLowStockProducts = (): Product[] => {
    const products = getProducts()
    return products.filter((p) => p.currentStock <= p.minStock)
  }

  const getCriticalStockProducts = (): Product[] => {
    const products = getProducts()
    return products.filter((p) => p.currentStock <= p.minStock * 0.5)
  }

  const updateStock = (productId: string, quantity: number, operation: 'add' | 'subtract' | 'set'): boolean => {
    const products = getProducts()
    const productIndex = products.findIndex((p) => p.id === productId)

    if (productIndex === -1) return false

    const product = products[productIndex]
    let newStock: number

    switch (operation) {
      case 'add':
        newStock = product.currentStock + quantity
        break
      case 'subtract':
        newStock = Math.max(0, product.currentStock - quantity)
        break
      case 'set':
        newStock = Math.max(0, quantity)
        break
      default:
        return false
    }

    products[productIndex] = {
      ...product,
      currentStock: newStock,
      updatedAt: new Date(),
    }

    saveProducts(products)
    return true
  }

  const checkStockAlert = (productId: string): boolean => {
    const product = getProducts().find((p) => p.id === productId)
    if (!product) return false
    return product.currentStock <= product.minStock
  }

  return {
    getProducts,
    saveProducts,
    getLowStockProducts,
    getCriticalStockProducts,
    updateStock,
    checkStockAlert,
  }
}

