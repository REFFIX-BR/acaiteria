import { useState, useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit, ChefHat, DollarSign, Image as ImageIcon, Package, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { MenuItem } from '@/types'

const menuItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  basePrice: z.number().min(0, 'Preço deve ser maior ou igual a zero'),
  image: z.string().optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  available: z.boolean(),
  maxAdditions: z.number().min(0).optional(),
  maxComplements: z.number().min(0).optional(),
  sizes: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Nome do tamanho é obrigatório'),
      price: z.number().positive('Preço do tamanho é obrigatório'),
    })
  ),
  additions: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Nome da cobertura é obrigatório'),
      price: z.number().min(0),
    })
  ),
  complements: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Nome do complemento é obrigatório'),
      price: z.number().min(0),
    })
  ),
  fruits: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Nome da fruta é obrigatório'),
      price: z.number().min(0),
    })
  ),
  maxFruits: z.number().min(0).optional(),
}).refine((data) => {
  // Se não tem tamanhos, o preço base é obrigatório
  if (data.sizes.length === 0) {
    return data.basePrice > 0
  }
  return true
}, {
  message: 'Preço é obrigatório quando não há tamanhos',
  path: ['basePrice'],
})

type MenuItemFormData = z.infer<typeof menuItemSchema>

interface MenuItemFormProps {
  menuItem?: MenuItem
  onSuccess?: () => void
  trigger?: React.ReactNode
}

const DEFAULT_CATEGORIES = [
  'Açaí',
  'Açaí com Frutas',
  'Vitamina',
  'Smoothie',
  'Sobremesas',
  'Bebidas',
  'Outros',
]

const CATEGORIES_STORAGE_KEY = 'categories'

export function MenuItemForm({ menuItem, onSuccess, trigger }: MenuItemFormProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: menuItem
      ? {
          name: menuItem.name,
          description: menuItem.description,
          basePrice: menuItem.basePrice,
          image: menuItem.image || '',
          category: menuItem.category,
          available: menuItem.available,
          maxAdditions: menuItem.maxAdditions,
          maxComplements: menuItem.maxComplements,
          maxFruits: menuItem.maxFruits,
          sizes: menuItem.sizes || [],
          additions: menuItem.additions || [],
          complements: menuItem.complements || [],
          fruits: menuItem.fruits || [],
        }
      : {
          basePrice: 0,
          available: true,
          maxAdditions: undefined,
          maxComplements: undefined,
          maxFruits: undefined,
          sizes: [],
          additions: [],
          complements: [],
          fruits: [],
        },
  })

  const {
    fields: sizeFields,
    append: appendSize,
    remove: removeSize,
  } = useFieldArray({
    control,
    name: 'sizes',
  })

  const {
    fields: additionFields,
    append: appendAddition,
    remove: removeAddition,
  } = useFieldArray({
    control,
    name: 'additions',
  })

  const {
    fields: complementFields,
    append: appendComplement,
    remove: removeComplement,
  } = useFieldArray({
    control,
    name: 'complements',
  })

  const {
    fields: fruitFields,
    append: appendFruit,
    remove: removeFruit,
  } = useFieldArray({
    control,
    name: 'fruits',
  })

  // Carrega todas as categorias disponíveis
  const allCategories = useMemo(() => {
    if (!currentTenant) return DEFAULT_CATEGORIES

    // Categorias padrão
    const defaultCats = [...DEFAULT_CATEGORIES]

    // Categorias customizadas do tenant
    const tenantCategories = getTenantData<string[]>(currentTenant.id, CATEGORIES_STORAGE_KEY) || []

    // Categorias dos itens existentes
    const menuItems = getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []
    const itemCategories = menuItems.map((item) => item.category)

    // Combina todas e remove duplicatas
    const combined = [...defaultCats, ...tenantCategories, ...itemCategories]
    return Array.from(new Set(combined)).sort()
  }, [currentTenant])

  // Função para criar nova categoria
  const handleCreateCategory = () => {
    if (!currentTenant) return

    const trimmedName = newCategoryName.trim()
    if (!trimmedName) {
      toast({
        title: 'Erro',
        description: 'O nome da categoria não pode estar vazio',
        variant: 'destructive',
      })
      return
    }

    if (allCategories.includes(trimmedName)) {
      toast({
        title: 'Erro',
        description: 'Esta categoria já existe',
        variant: 'destructive',
      })
      return
    }

    try {
      // Pega categorias existentes do tenant
      const existingCategories = getTenantData<string[]>(currentTenant.id, CATEGORIES_STORAGE_KEY) || []
      
      // Adiciona a nova categoria
      const updatedCategories = [...existingCategories, trimmedName]
      setTenantData(currentTenant.id, CATEGORIES_STORAGE_KEY, updatedCategories)

      // Seleciona a nova categoria no formulário
      setValue('category', trimmedName)

      toast({
        title: 'Sucesso',
        description: 'Categoria criada com sucesso',
      })

      setNewCategoryName('')
      setNewCategoryDialogOpen(false)
    } catch (error) {
      console.error('Erro ao criar categoria:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao criar categoria',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    if (menuItem) {
      setValue('name', menuItem.name)
      setValue('description', menuItem.description)
      setValue('basePrice', menuItem.basePrice)
      setValue('image', menuItem.image || '')
      setValue('category', menuItem.category)
      setValue('available', menuItem.available)
      setValue('maxAdditions', menuItem.maxAdditions)
      setValue('maxComplements', menuItem.maxComplements)
      setValue('maxFruits', menuItem.maxFruits)
      setValue('sizes', menuItem.sizes || [])
      setValue('additions', menuItem.additions || [])
      setValue('complements', menuItem.complements || [])
      setValue('fruits', menuItem.fruits || [])
    } else {
      reset({
        basePrice: 0,
        available: true,
        maxAdditions: undefined,
        maxComplements: undefined,
        maxFruits: undefined,
        sizes: [],
        additions: [],
        complements: [],
        fruits: [],
      })
    }
  }, [menuItem, setValue, reset])

  const onSubmit = async (data: MenuItemFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      const menuItems = getTenantData<MenuItem[]>(currentTenant.id, 'menu') || []
      let savedItem: MenuItem

      // Prepara o payload para o backend
      const { getApiUrl } = await import('@/lib/api/config')
      const { getAuthToken } = await import('@/lib/api/auth')
      const apiUrl = getApiUrl()
      const token = getAuthToken()

      if (menuItem) {
        // Editar item existente
        const index = menuItems.findIndex((m) => m.id === menuItem.id)
        if (index !== -1) {
          savedItem = {
            ...menuItem,
            ...data,
            maxAdditions: data.maxAdditions || undefined,
            maxComplements: data.maxComplements || undefined,
            maxFruits: data.maxFruits || undefined,
            image: data.image || undefined,
            updatedAt: new Date(),
          }
          menuItems[index] = savedItem

          // Atualiza no backend
          const response = await fetch(`${apiUrl}/api/menu/items/${menuItem.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              name: data.name,
              description: data.description,
              basePrice: data.basePrice,
              image: data.image || null,
              category: data.category,
              available: data.available,
              maxAdditions: data.maxAdditions || null,
              maxComplements: data.maxComplements || null,
              maxFruits: data.maxFruits || null,
              sizes: data.sizes || [],
              additions: data.additions || [],
              complements: data.complements || [],
              fruits: data.fruits || [],
            }),
          })

          if (!response.ok) {
            console.error('[MenuItemForm] Erro ao atualizar no backend:', response.status)
          }
        }
      } else {
        // Criar novo item
        savedItem = {
          id: `menu-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          maxAdditions: data.maxAdditions || undefined,
          maxComplements: data.maxComplements || undefined,
          image: data.image || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        menuItems.push(savedItem)

        // Salva no backend
        const response = await fetch(`${apiUrl}/api/menu/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            basePrice: data.basePrice,
            image: data.image || null,
            category: data.category,
            available: data.available,
            maxAdditions: data.maxAdditions || null,
            maxComplements: data.maxComplements || null,
            maxFruits: data.maxFruits || null,
            sizes: data.sizes || [],
            additions: data.additions || [],
            complements: data.complements || [],
            fruits: data.fruits || [],
          }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.item && result.item.id) {
            // Atualiza o ID com o retornado do backend
            savedItem.id = result.item.id
            menuItems[menuItems.length - 1] = savedItem
          }
        } else {
          console.error('[MenuItemForm] Erro ao criar no backend:', response.status)
        }
      }

      // Salva no localStorage
      setTenantData(currentTenant.id, 'menu', menuItems)

      toast({
        title: 'Sucesso',
        description: menuItem ? 'Item atualizado com sucesso' : 'Item cadastrado com sucesso',
      })

      setOpen(false)
      onSuccess?.()
      reset()
    } catch (error) {
      console.error('Erro ao salvar item:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar item',
        variant: 'destructive',
      })
    }
  }

  const onError = (errors: any) => {
    console.error('Erros de validação:', errors)
  }

  const defaultTrigger = menuItem ? (
    <Button variant="ghost" size="icon">
      <Edit className="h-4 w-4" />
    </Button>
  ) : (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Novo Item
    </Button>
  )

  const basePrice = watch('basePrice') || 0

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            {menuItem ? 'Editar Item do Cardápio' : 'Novo Item do Cardápio'}
          </DialogTitle>
          <DialogDescription>
            {menuItem ? 'Atualize as informações do item' : 'Preencha os dados do novo item'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Informações do Produto
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    Nome do Produto *
                  </Label>
                  <Input
                    id="name"
                    placeholder="Ex: Açaí 300ml"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Categoria *
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={watch('category')}
                      onValueChange={(value) => setValue('category', value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setNewCategoryDialogOpen(true)}
                      title="Criar nova categoria"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.category && (
                    <p className="text-sm text-destructive">{errors.category.message}</p>
                  )}
                </div>

                {sizeFields.length === 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="basePrice" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Preço (R$) *
                    </Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...register('basePrice', { valueAsNumber: true })}
                    />
                    {errors.basePrice && (
                      <p className="text-sm text-destructive">{errors.basePrice.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Preço do produto (use tamanhos se quiser variações de preço)
                    </p>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    placeholder="Descreva o produto de forma atrativa..."
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="image" className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Foto do Produto (URL)
                  </Label>
                  <Input
                    id="image"
                    type="url"
                    placeholder="https://exemplo.com/imagem.jpg"
                    {...register('image')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Link da imagem do produto (opcional)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tamanhos */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Tamanhos (Opcional)</h3>
                  <p className="text-sm text-muted-foreground">
                    Se o produto tiver tamanhos, defina o preço completo de cada um. Se não adicionar tamanhos, use o preço fixo acima.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendSize({ id: `size-${Date.now()}`, name: '', price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Tamanho
                </Button>
              </div>

              {sizeFields.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Nenhum tamanho adicionado. O produto terá preço fixo definido acima.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sizeFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 p-3 border rounded-lg bg-muted/50">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Nome do tamanho</Label>
                          <Input
                            placeholder="Ex: P, M, G, 300ml"
                            {...register(`sizes.${index}.name`)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Preço (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register(`sizes.${index}.price`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSize(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coberturas */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Coberturas</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione as coberturas disponíveis (ex: Leite Condensado, Chocolate, Caramelo)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendAddition({ id: `add-${Date.now()}`, name: '', price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Cobertura
                </Button>
              </div>

              {/* Limite de Coberturas */}
              {additionFields.length > 0 && (
                <div className="mb-4 p-3 border rounded-lg bg-muted/30">
                  <Label htmlFor="maxAdditions" className="text-sm font-medium mb-2 block">
                    Limite de coberturas por pedido (opcional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="maxAdditions"
                      type="number"
                      min="0"
                      placeholder="Sem limite"
                      {...register('maxAdditions', { valueAsNumber: true })}
                      className="max-w-[150px]"
                    />
                    <span className="text-sm text-muted-foreground">
                      {watch('maxAdditions') 
                        ? `Máximo ${watch('maxAdditions')} cobertura${watch('maxAdditions') !== 1 ? 's' : ''} por pedido`
                        : 'Sem limite'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para permitir seleção ilimitada. Ex: 1 = apenas 1 cobertura por açaí
                  </p>
                </div>
              )}

              {additionFields.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma cobertura adicionada. Clique em "Adicionar Cobertura" para começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {additionFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 p-3 border rounded-lg bg-muted/50">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Nome da cobertura</Label>
                          <Input
                            placeholder="Ex: Leite Condensado"
                            {...register(`additions.${index}.name`)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Valor adicional (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register(`additions.${index}.price`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAddition(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Complementos */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Complementos</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione os complementos disponíveis (ex: Banana, Morango, Kiwi, Granola)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendComplement({ id: `comp-${Date.now()}`, name: '', price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Complemento
                </Button>
              </div>

              {/* Limite de Complementos */}
              {complementFields.length > 0 && (
                <div className="mb-4 p-3 border rounded-lg bg-muted/30">
                  <Label htmlFor="maxComplements" className="text-sm font-medium mb-2 block">
                    Limite de complementos por pedido (opcional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="maxComplements"
                      type="number"
                      min="0"
                      placeholder="Sem limite"
                      {...register('maxComplements', { valueAsNumber: true })}
                      className="max-w-[150px]"
                    />
                    <span className="text-sm text-muted-foreground">
                      {watch('maxComplements') 
                        ? `Máximo ${watch('maxComplements')} complemento${watch('maxComplements') !== 1 ? 's' : ''} por pedido`
                        : 'Sem limite'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para permitir seleção ilimitada. Ex: 3 = máximo 3 complementos por açaí
                  </p>
                </div>
              )}

              {complementFields.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Nenhum complemento adicionado. Clique em "Adicionar Complemento" para começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {complementFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 p-3 border rounded-lg bg-muted/50">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Nome do complemento</Label>
                          <Input
                            placeholder="Ex: Banana, Morango"
                            {...register(`complements.${index}.name`)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Valor adicional (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register(`complements.${index}.price`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComplement(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Frutas */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Frutas</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione as frutas disponíveis (ex: Banana, Morango, Kiwi, Uva, Manga)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendFruit({ id: `fruit-${Date.now()}`, name: '', price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Fruta
                </Button>
              </div>

              {/* Limite de Frutas */}
              {fruitFields.length > 0 && (
                <div className="mb-4 p-3 border rounded-lg bg-muted/30">
                  <Label htmlFor="maxFruits" className="text-sm font-medium mb-2 block">
                    Limite de frutas por pedido (opcional)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="maxFruits"
                      type="number"
                      min="0"
                      placeholder="Sem limite"
                      {...register('maxFruits', { valueAsNumber: true })}
                      className="max-w-[150px]"
                    />
                    <span className="text-sm text-muted-foreground">
                      {watch('maxFruits') 
                        ? `Máximo ${watch('maxFruits')} fruta${watch('maxFruits') !== 1 ? 's' : ''} por pedido`
                        : 'Sem limite'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Deixe em branco para permitir seleção ilimitada. Ex: 2 = máximo 2 frutas por açaí
                  </p>
                </div>
              )}

              {fruitFields.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Nenhuma fruta adicionada. Clique em "Adicionar Fruta" para começar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fruitFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 p-3 border rounded-lg bg-muted/50">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Nome da fruta</Label>
                          <Input
                            placeholder="Ex: Banana, Morango"
                            {...register(`fruits.${index}.name`)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Valor adicional (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register(`fruits.${index}.price`, { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFruit(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disponibilidade */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="available" className="text-base font-medium cursor-pointer">
                    Item disponível no cardápio
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Se desativado, o item não aparecerá no cardápio público
                  </p>
                </div>
                <Switch
                  id="available"
                  checked={watch('available')}
                  onCheckedChange={(checked) => setValue('available', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : menuItem ? 'Atualizar' : 'Salvar Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Dialog para criar nova categoria */}
    <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
          <DialogDescription>
            Digite o nome da nova categoria que deseja criar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newCategoryName">Nome da Categoria</Label>
            <Input
              id="newCategoryName"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ex: Açaí Especial"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateCategory()
                }
              }}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setNewCategoryDialogOpen(false)
              setNewCategoryName('')
            }}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleCreateCategory}>
            Criar Categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
