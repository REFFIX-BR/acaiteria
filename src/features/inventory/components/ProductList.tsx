import { useState, useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { useStockControl } from '../hooks/useStockControl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductForm } from './ProductForm'
import { useToast } from '@/hooks/use-toast'
import { Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface ProductListProps {
  refreshTrigger?: number
}

export function ProductList({ refreshTrigger }: ProductListProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { getProducts, saveProducts, checkStockAlert } = useStockControl()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const products = useMemo(() => {
    let filtered = getProducts()

    if (searchTerm) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category === categoryFilter)
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [getProducts, searchTerm, categoryFilter, refreshTrigger])

  const categories = useMemo(() => {
    const allCategories = getProducts().map((p) => p.category)
    return Array.from(new Set(allCategories)).sort()
  }, [getProducts])

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) {
      return
    }

    try {
      const allProducts = getProducts()
      const updated = allProducts.filter((p) => p.id !== id)
      saveProducts(updated)

      toast({
        title: 'Sucesso',
        description: 'Produto excluído com sucesso',
      })
    } catch (error) {
      console.error('Erro ao excluir produto:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao excluir produto',
        variant: 'destructive',
      })
    }
  }

  const getStockStatus = (product: Product) => {
    if (product.currentStock <= product.minStock * 0.5) {
      return { status: 'critical', label: 'Crítico' }
    }
    if (product.currentStock <= product.minStock) {
      return { status: 'low', label: 'Baixo' }
    }
    return { status: 'ok', label: 'OK' }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos e Ingredientes</CardTitle>
        <CardDescription>
          Gerencie o estoque de produtos e ingredientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {getProducts().length === 0
              ? 'Nenhum produto cadastrado'
              : 'Nenhum produto encontrado com os filtros aplicados'}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const stockStatus = getStockStatus(product)
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell className="text-right">
                        {product.currentStock} {product.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.minStock} {product.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {stockStatus.status === 'critical' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            {stockStatus.label}
                          </span>
                        )}
                        {stockStatus.status === 'low' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-2 py-1 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            {stockStatus.label}
                          </span>
                        )}
                        {stockStatus.status === 'ok' && (
                          <span className="text-xs text-muted-foreground">{stockStatus.label}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProductForm product={product} />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

