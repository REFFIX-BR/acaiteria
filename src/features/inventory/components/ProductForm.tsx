import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantData, setTenantData } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Edit } from 'lucide-react'
import type { Product } from '@/types'

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  currentStock: z.number().min(0, 'Estoque não pode ser negativo'),
  minStock: z.number().min(0, 'Estoque mínimo não pode ser negativo'),
  unit: z.string().min(1, 'Unidade é obrigatória'),
  price: z.number().positive('Preço deve ser maior que zero'),
})

type ProductFormData = z.infer<typeof productSchema>

interface ProductFormProps {
  product?: Product
  onSuccess?: () => void
  trigger?: React.ReactNode
}

const categories = [
  'Açaí',
  'Frutas',
  'Granola',
  'Complementos',
  'Leite/Creme',
  'Coberturas',
  'Outros',
]

const units = ['kg', 'g', 'L', 'mL', 'un', 'pct', 'cx']

export function ProductForm({ product, onSuccess, trigger }: ProductFormProps) {
  const currentTenant = useTenantStore((state) => state.currentTenant)
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          category: product.category,
          currentStock: product.currentStock,
          minStock: product.minStock,
          unit: product.unit,
          price: product.price,
        }
      : {
          currentStock: 0,
          minStock: 0,
          price: 0,
        },
  })

  const selectedCategory = watch('category')

  useEffect(() => {
    if (product) {
      setValue('name', product.name)
      setValue('category', product.category)
      setValue('currentStock', product.currentStock)
      setValue('minStock', product.minStock)
      setValue('unit', product.unit)
      setValue('price', product.price)
    }
  }, [product, setValue])

  const onSubmit = async (data: ProductFormData) => {
    if (!currentTenant) {
      toast({
        title: 'Erro',
        description: 'Tenant não encontrado',
        variant: 'destructive',
      })
      return
    }

    try {
      const products = getTenantData<Product[]>(currentTenant.id, 'products') || []

      if (product) {
        // Editar produto existente
        const index = products.findIndex((p) => p.id === product.id)
        if (index !== -1) {
          products[index] = {
            ...product,
            ...data,
            updatedAt: new Date(),
          }
        }
      } else {
        // Criar novo produto
        const newProduct: Product = {
          id: `product-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        products.push(newProduct)
      }

      setTenantData(currentTenant.id, 'products', products)

      toast({
        title: 'Sucesso',
        description: product ? 'Produto atualizado com sucesso' : 'Produto cadastrado com sucesso',
      })

      reset()
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('Erro ao salvar produto:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao salvar produto',
        variant: 'destructive',
      })
    }
  }

  const defaultTrigger = product ? (
    <Button variant="ghost" size="icon">
      <Edit className="h-4 w-4" />
    </Button>
  ) : (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Novo Produto
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>
            {product ? 'Atualize as informações do produto' : 'Cadastre um novo produto ou ingrediente'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Ex: Açaí 100%"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select onValueChange={(value) => setValue('category', value)} defaultValue={selectedCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('category')} />
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentStock">Estoque Atual</Label>
              <Input
                id="currentStock"
                type="number"
                step="0.01"
                placeholder="0"
                {...register('currentStock', { valueAsNumber: true })}
              />
              {errors.currentStock && (
                <p className="text-sm text-destructive">{errors.currentStock.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="minStock">Estoque Mínimo</Label>
              <Input
                id="minStock"
                type="number"
                step="0.01"
                placeholder="0"
                {...register('minStock', { valueAsNumber: true })}
              />
              {errors.minStock && (
                <p className="text-sm text-destructive">{errors.minStock.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Select onValueChange={(value) => setValue('unit', value)} defaultValue={watch('unit')}>
                <SelectTrigger id="unit">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" {...register('unit')} />
              {errors.unit && (
                <p className="text-sm text-destructive">{errors.unit.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('price', { valueAsNumber: true })}
              />
              {errors.price && (
                <p className="text-sm text-destructive">{errors.price.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

