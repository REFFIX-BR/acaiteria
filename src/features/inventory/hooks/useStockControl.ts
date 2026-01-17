import { useState, useEffect } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import type { Product } from '@/types'

/**
 * Hook para controle de estoque (agora usa backend)
 */
export function useStockControl() {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const [products, setProducts] = useState<Product[]>([])

  // Buscar produtos do backend
  useEffect(() => {
    const loadProducts = async () => {
      if (!currentTenant) {
        setProducts([])
        return
      }

      try {
        const { getApiUrl } = await import('@/lib/api/config')
        const { getAuthToken } = await import('@/lib/api/auth')
        const apiUrl = getApiUrl()
        const token = getAuthToken()

        if (!token) {
          setProducts([])
          return
        }

        const response = await fetch(`${apiUrl}/api/products`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const data = await response.json()
          const normalizedProducts = (data.products || []).map((p: any) => ({
            ...p,
            currentStock: Number(p.current_stock || p.currentStock || 0),
            minStock: Number(p.min_stock || p.minStock || 0),
            createdAt: p.created_at ? new Date(p.created_at) : (p.createdAt ? new Date(p.createdAt) : new Date()),
            updatedAt: p.updated_at ? new Date(p.updated_at) : (p.updatedAt ? new Date(p.updatedAt) : new Date()),
          }))
          setProducts(normalizedProducts)
        } else {
          console.error('[useStockControl] Erro ao buscar produtos:', response.status)
          setProducts([])
        }
      } catch (error) {
        console.error('[useStockControl] Erro ao buscar produtos:', error)
        setProducts([])
      }
    }

    loadProducts()
  }, [currentTenant])

  const getProducts = (): Product[] => {
    return products
  }

  const saveProducts = (products: Product[]): void => {
    // Não salva mais localmente, apenas atualiza estado local
    setProducts(products)
  }

  const getLowStockProducts = (): Product[] => {
    const products = getProducts()
    return products.filter((p) => p.currentStock <= p.minStock)
  }

  const getCriticalStockProducts = (): Product[] => {
    const products = getProducts()
    return products.filter((p) => p.currentStock <= p.minStock * 0.5)
  }

  const updateStock = async (productId: string, quantity: number, operation: 'add' | 'subtract' | 'set'): Promise<boolean> => {
    const products = getProducts()
    const product = products.find((p) => p.id === productId)

    if (!product) return false

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

    try {
      const { getApiUrl } = await import('@/lib/api/config')
      const { getAuthToken } = await import('@/lib/api/auth')
      const apiUrl = getApiUrl()
      const token = getAuthToken()

      if (!token) {
        return false
      }

      // Atualizar no backend
      const response = await fetch(`${apiUrl}/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: product.name,
          category: product.category,
          currentStock: newStock,
          minStock: product.minStock,
          unit: product.unit,
          price: product.price,
        }),
      })

      if (!response.ok) {
        return false
      }

      // Atualizar estado local
      setProducts(prev => prev.map(p => 
        p.id === productId 
          ? { ...p, currentStock: newStock, updatedAt: new Date() }
          : p
      ))

      return true
    } catch (error) {
      console.error('[useStockControl] Erro ao atualizar estoque:', error)
      return false
    }
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

