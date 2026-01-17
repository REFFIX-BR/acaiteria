import { useState, useMemo } from 'react'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
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
import { MenuItemForm } from './MenuItemForm'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Eye, EyeOff } from 'lucide-react'
import { getMenuPublicUrl, copyMenuUrl } from '@/lib/menu/menuUrl'
import type { MenuItem } from '@/types'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useDebounce } from '@/hooks/use-debounce'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface MenuItemListProps {
  refreshTrigger?: number
  onRefresh?: () => void
}

export function MenuItemList({ refreshTrigger, onRefresh }: MenuItemListProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  
  // Debounce na busca
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const menuItems = useMemo(() => {
    if (!currentTenant) return []
    
    let filtered = getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []

    if (debouncedSearchTerm) {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === categoryFilter)
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [currentTenant, debouncedSearchTerm, categoryFilter, refreshTrigger])

  const categories = useMemo(() => {
    if (!currentTenant) return []
    const items = getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []
    const allCategories = items.map((item) => item.category)
    return Array.from(new Set(allCategories)).sort()
  }, [currentTenant])

  const handleDelete = async (id: string) => {
    if (!currentTenant) return

    confirm(
      'Tem certeza que deseja excluir este item do cardápio? Esta ação não pode ser desfeita.',
      async () => {
        try {
          // Tenta deletar no backend primeiro
          try {
            const { getApiUrl } = await import('@/lib/api/config')
            const { getAuthToken } = await import('@/lib/api/auth')
            const apiUrl = getApiUrl()
            const token = getAuthToken()

            const response = await fetch(`${apiUrl}/api/menu/items/${id}`, {
              method: 'DELETE',
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            })

            if (!response.ok && response.status !== 404) {
              console.error('[MenuItemList] Erro ao deletar no backend:', response.status)
            }
          } catch (error) {
            console.error('[MenuItemList] Erro ao deletar no backend:', error)
            // Continua para deletar do localStorage mesmo se o backend falhar
          }

          // Deleta do localStorage
          const allItems = getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []
          const updated = allItems.filter((item) => item.id !== id)
          setTenantData(currentTenant.id, 'menu', updated)

          toast({
            title: 'Sucesso',
            description: 'Item excluído com sucesso',
          })

          // Atualiza a lista em tempo real
          onRefresh?.()
        } catch (error) {
          console.error('Erro ao excluir item:', error)
          toast({
            title: 'Erro',
            description: 'Erro ao excluir item',
            variant: 'destructive',
          })
        }
      },
      {
        title: 'Excluir item do cardápio',
        variant: 'destructive',
        confirmText: 'Excluir',
      }
    )
  }

  const handleToggleAvailable = async (item: MenuItem) => {
    if (!currentTenant) return

    try {
      const newAvailable = !item.available
      const allItems = getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []
      const index = allItems.findIndex((i) => i.id === item.id)
      
      if (index !== -1) {
        // Atualiza no backend primeiro
        try {
          const { getApiUrl } = await import('@/lib/api/config')
          const { getAuthToken } = await import('@/lib/api/auth')
          const apiUrl = getApiUrl()
          const token = getAuthToken()

          const response = await fetch(`${apiUrl}/api/menu/items/${item.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              available: newAvailable,
            }),
          })

          if (!response.ok) {
            console.error('[MenuItemList] Erro ao atualizar no backend:', response.status)
          }
        } catch (error) {
          console.error('[MenuItemList] Erro ao atualizar no backend:', error)
          // Continua para atualizar no localStorage mesmo se o backend falhar
        }

        // Atualiza no localStorage
        allItems[index] = {
          ...item,
          available: newAvailable,
          updatedAt: new Date(),
        }
        setTenantData(currentTenant.id, 'menu', allItems)
        toast({
          title: 'Sucesso',
          description: item.available ? 'Item ocultado' : 'Item disponibilizado',
        })
        
        // Atualiza a lista em tempo real
        onRefresh?.()
      }
    } catch (error) {
      console.error('Erro ao atualizar item:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar item',
        variant: 'destructive',
      })
    }
  }

  const handleCopyLink = async () => {
    if (!currentTenant) return

    const success = await copyMenuUrl(currentTenant.slug)
    if (success) {
      toast({
        title: 'Link copiado!',
        description: 'Link do cardápio copiado para a área de transferência',
      })
    } else {
      toast({
        title: 'Erro',
        description: 'Erro ao copiar link',
        variant: 'destructive',
      })
    }
  }

  if (!currentTenant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Itens do Cardápio Digital</CardTitle>
            <CardDescription>
              Gerencie os itens do seu cardápio digital
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleCopyLink}>
            Copiar Link Público
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Buscar item..."
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

        {/* Link público */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Link público do cardápio:</p>
          <p className="text-sm font-mono break-all">{getMenuPublicUrl(currentTenant.slug)}</p>
        </div>

        {/* Lista de itens */}
        {menuItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum item cadastrado no cardápio
          </div>
        ) : (
          <div className="space-y-4">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 border rounded-lg ${!item.available ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      {!item.available && (
                        <span className="text-xs text-muted-foreground">(Indisponível)</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-medium">
                        Preço base: {formatCurrency(item.basePrice)}
                      </span>
                      <span className="text-muted-foreground">Categoria: {item.category}</span>
                    </div>
                    {(item.sizes.length > 0 || item.additions.length > 0 || item.complements.length > 0) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.sizes.length > 0 && <span>Tamanhos: {item.sizes.length} </span>}
                        {item.additions.length > 0 && <span>Adicionais: {item.additions.length} </span>}
                        {item.complements.length > 0 && <span>Complementos: {item.complements.length}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleAvailable(item)}
                      title={item.available ? 'Ocultar' : 'Mostrar'}
                    >
                      {item.available ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <MenuItemForm menuItem={item} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {ConfirmDialogComponent}
    </Card>
  )
}

