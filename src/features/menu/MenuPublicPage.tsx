import { useParams } from 'react-router-dom'
import { useMemo, useState, useEffect, useRef } from 'react'
import { getTenantBySlug, getTenantData, setTenantData, setGlobalData, getGlobalData, getAllTenants } from '@/lib/storage/storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShoppingCart, ChefHat, Clock, Lock, Search, Plus, Menu as MenuIcon, X } from 'lucide-react'
import type { MenuItem, SizeOption, Addition, Complement, Fruit, OperatingHours, Customer } from '@/types'
import { cn, isStoreOpen, getStoreClosingTime } from '@/lib/utils'
import { ProductCustomizationModal } from './components/ProductCustomizationModal'
import { CartSidebar } from './components/CartSidebar'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export interface CartItem {
  id: string
  item: MenuItem
  size?: SizeOption
  additions: Addition[]
  complements: Complement[]
  fruits: Fruit[]
  quantity: number
}

interface CustomerData {
  name: string
  phone: string
}

const CUSTOMER_STORAGE_KEY = 'menu_customer_data'

export default function MenuPublicPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>()
  const [selectedItems, setSelectedItems] = useState<Map<string, CartItem>>(new Map())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [tenant, setTenant] = useState<any | null>(null)
  const [isLoadingTenant, setIsLoadingTenant] = useState(true)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuSettings, setMenuSettings] = useState<any | null>(null)
  const [isLoadingMenu, setIsLoadingMenu] = useState(false)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  // Carrega dados do cliente do localStorage ao montar
  useEffect(() => {
    const savedCustomer = getGlobalData<CustomerData>(CUSTOMER_STORAGE_KEY)
    if (savedCustomer?.name && savedCustomer?.phone) {
      setCustomerData(savedCustomer)
    }
  }, [])

  // Busca tenant do backend quando o slug muda
  useEffect(() => {
    const fetchTenant = async () => {
      if (!tenantSlug) {
        setIsLoadingTenant(false)
        return
      }

      setIsLoadingTenant(true)
      try {
        // Primeiro tenta buscar do localStorage (para casos onde o admin já está logado)
        const localTenant = getTenantBySlug(tenantSlug)
        if (localTenant) {
          setTenant(localTenant)
          setIsLoadingTenant(false)
          return
        }

        // Se não encontrar no localStorage, busca do backend
        const { getApiUrl } = await import('@/lib/api/config')
        const apiUrl = getApiUrl()
        const response = await fetch(`${apiUrl}/api/tenants/slug/${tenantSlug}`)
        
        if (response.ok) {
          const data = await response.json()
          if (data.tenant) {
            setTenant(data.tenant)
          } else {
            setTenant(null)
          }
        } else {
          console.error('[MenuPublicPage] Erro ao buscar tenant:', response.status, response.statusText)
          setTenant(null)
        }
      } catch (error) {
        console.error('[MenuPublicPage] Erro ao buscar tenant:', error)
        setTenant(null)
      } finally {
        setIsLoadingTenant(false)
      }
    }

    fetchTenant()
  }, [tenantSlug])

  // Busca dados do menu quando o tenant é carregado
  useEffect(() => {
    const fetchMenuData = async () => {
      if (!tenant || !tenantSlug) {
        setMenuItems([])
        setMenuSettings(null)
        return
      }

      setIsLoadingMenu(true)
      try {
        // SEMPRE busca do backend - nunca do localStorage na página pública
        const { getApiUrl } = await import('@/lib/api/config')
        const apiUrl = getApiUrl()
        const menuResponse = await fetch(`${apiUrl}/api/menu/public/${tenantSlug}`)
        
        if (menuResponse.ok) {
          const menuData = await menuResponse.json()
          if (menuData.items && Array.isArray(menuData.items)) {
            // Converte os dados do backend para o formato esperado
            const formattedItems: MenuItem[] = menuData.items.map((item: any) => ({
              id: item.id,
              menuItemId: item.id,
              menuItemName: item.name,
              name: item.name,
              description: item.description || '',
              basePrice: parseFloat(item.base_price) || 0,
              image: item.image || '',
              category: item.category || '',
              available: item.available ?? true,
              maxAdditions: item.max_additions || undefined,
              maxComplements: item.max_complements || undefined,
              maxFruits: item.max_fruits || undefined,
              sizes: item.sizes || [],
              additions: item.additions || [],
              complements: item.complements || [],
              fruits: item.fruits || [],
              createdAt: new Date(item.created_at),
              updatedAt: new Date(item.updated_at),
            }))
            setMenuItems(formattedItems)
          } else {
            setMenuItems([])
          }
        } else {
          console.error('[MenuPublicPage] Erro ao buscar menu:', menuResponse.status)
          setMenuItems([])
        }
      } catch (error) {
        console.error('[MenuPublicPage] Erro ao buscar menu:', error)
        setMenuItems([])
      } finally {
        setIsLoadingMenu(false)
      }
    }

    fetchMenuData()
  }, [tenant, tenantSlug])

  const storeStatus = useMemo(() => {
    if (!tenant) return { isOpen: true }
    const settings = getTenantData<{ operatingHours: OperatingHours[], timezone?: string }>(tenant.id, 'settings')
    if (!settings?.operatingHours || settings.operatingHours.length === 0) {
      return { isOpen: true }
    }
    return isStoreOpen(settings.operatingHours, settings.timezone || 'America/Sao_Paulo')
  }, [tenant])

  const closingTime = useMemo(() => {
    if (!tenant) return null
    const settings = getTenantData<{ operatingHours: OperatingHours[], timezone?: string }>(tenant.id, 'settings')
    if (!settings?.operatingHours || settings.operatingHours.length === 0) {
      return null
    }
    return getStoreClosingTime(settings.operatingHours, settings.timezone || 'America/Sao_Paulo')
  }, [tenant])

  const availableItems = useMemo(() => {
    return menuItems.filter((item) => item.available)
  }, [menuItems])

  const categories = useMemo(() => {
    const cats = new Set(availableItems.map((item) => item.category))
    return Array.from(cats).sort()
  }, [availableItems])

  const filteredItems = useMemo(() => {
    let filtered = availableItems

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === selectedCategory)
    }

    return filtered
  }, [availableItems, searchTerm, selectedCategory])

  const calculateItemPrice = (item: MenuItem, size?: SizeOption, additions: Addition[] = [], complements: Complement[] = [], fruits: Fruit[] = []) => {
    let total = size ? size.price : item.basePrice
    additions.forEach((add) => (total += add.price))
    complements.forEach((comp) => (total += comp.price))
    fruits.forEach((fruit) => (total += fruit.price))
    return total
  }

  const handleAddToCart = (item: MenuItem, size?: SizeOption, additions: Addition[] = [], complements: Complement[] = [], quantity: number = 1, fruits?: Fruit[]) => {
    // Permite adicionar ao carrinho sem identificação
    // A identificação será solicitada apenas ao finalizar o pedido
    const key = `${item.id}-${size?.id || 'default'}-${Date.now()}`
    setSelectedItems((prev) => {
      const newMap = new Map(prev)
      newMap.set(key, {
        id: key,
        item,
        size,
        additions,
        complements,
        fruits: fruits || [],
        quantity,
      })
      return newMap
    })
    setCartOpen(true)
  }

  const handleCustomize = (item: MenuItem) => {
    setCustomizingItem(item)
  }

  const handleAddToCartFromModal = (size?: SizeOption, additions?: Addition[], complements?: Complement[], fruits?: Fruit[], quantity?: number) => {
    if (!customizingItem) return
    handleAddToCart(customizingItem, size, additions || [], complements || [], quantity || 1, fruits)
    setCustomizingItem(null)
  }

  const handleAddToCartForProductCard = (item: MenuItem, size?: SizeOption, additions?: Addition[], complements?: Complement[], quantity?: number, fruits?: Fruit[]) => {
    handleAddToCart(item, size, additions || [], complements || [], quantity || 1, fruits)
  }


  const totalCart = useMemo(() => {
    let total = 0
    selectedItems.forEach((cartItem) => {
      const itemTotal = calculateItemPrice(
        cartItem.item,
        cartItem.size,
        cartItem.additions,
        cartItem.complements,
        cartItem.fruits
      )
      total += itemTotal * cartItem.quantity
    })
    return total
  }, [selectedItems])

  const cartItemCount = useMemo(() => {
    let count = 0
    selectedItems.forEach((item) => {
      count += item.quantity
    })
    return count
  }, [selectedItems])

  // Mostra loading enquanto busca o tenant
  if (isLoadingTenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6 inline-block p-5 bg-blue-50 rounded-full animate-pulse">
            <ChefHat className="h-14 w-14 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-gray-900">
            Carregando...
          </h1>
          <p className="text-gray-600">Buscando informações da açaiteria...</p>
        </div>
      </div>
    )
  }

  // Mostra erro se não encontrou o tenant
  if (!tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6 inline-block p-5 bg-red-50 rounded-full">
            <ChefHat className="h-14 w-14 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-gray-900">
            Açaiteria não encontrada
          </h1>
          <p className="text-gray-600">O cardápio solicitado não existe.</p>
        </div>
      </div>
    )
  }

  if (!storeStatus.isOpen) {
    const primaryColor = (menuSettings && menuSettings.accentColor) ? menuSettings.accentColor : (tenant.primaryColor || '#ee8c2b')
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6 inline-block p-6 rounded-full" style={{ backgroundColor: `${primaryColor}15` }}>
            <Lock className="h-16 w-16" style={{ color: primaryColor }} />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-gray-900">
            Loja Fechada
          </h1>
          <p className="text-lg mb-2 text-gray-600">
            {tenant.name} está fechada no momento.
          </p>
          {storeStatus.nextOpenTime && (
            <p className="text-base text-gray-500 mb-6">
              Próxima abertura: <strong className="text-gray-900">{storeStatus.nextOpenTime}</strong>
            </p>
          )}
        </div>
      </div>
    )
  }

  const primaryColor = (menuSettings && menuSettings.accentColor) ? menuSettings.accentColor : (tenant.primaryColor || '#ee8c2b')
  const backgroundColor = menuSettings?.backgroundColor || '#f9fafb' // bg-gray-50 como padrão
  const textColor = menuSettings?.textColor || '#111827' // text-gray-900 como padrão
  const currentCategory = selectedCategory === 'all' ? 'Todos os Produtos' : selectedCategory
  const currentCategoryItems = filteredItems.filter(item => 
    selectedCategory === 'all' || item.category === selectedCategory
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor, color: textColor }}>
      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className={cn(
              "fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:hidden overflow-y-auto",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3" style={{ color: primaryColor }}>
                  {tenant.logo ? (
                    <img src={tenant.logo} alt={tenant.name} className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <ChefHat className="h-8 w-8" />
                  )}
                  <h2 className="text-xl font-bold">{tenant.name}</h2>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-6 w-6 text-gray-600" />
                </button>
              </div>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedCategory('all')
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                    selectedCategory === 'all'
                      ? "text-white font-semibold shadow-sm"
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                  style={selectedCategory === 'all' ? { backgroundColor: primaryColor } : {}}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat)
                      setSidebarOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                      selectedCategory === cat
                        ? "text-white font-semibold shadow-sm"
                        : "hover:bg-gray-100 text-gray-700"
                    )}
                    style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        </>
      )}

      {/* Header Fixo */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            {/* Logo/Nome */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MenuIcon className="h-6 w-6 text-gray-700" />
            </button>
            <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-initial" style={{ color: primaryColor }}>
              {tenant.logo ? (
                <img src={tenant.logo} alt={tenant.name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <ChefHat className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" />
              )}
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{tenant.name}</h1>
            </div>

            {/* Busca */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  className="w-full bg-gray-50 border-gray-200 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:border-transparent placeholder:text-gray-400 transition-all"
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ '--tw-ring-color': primaryColor } as any}
                />
              </div>
            </div>

            {/* Carrinho */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ShoppingCart className="h-6 w-6 text-gray-700" />
              {cartItemCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Busca Mobile */}
        <div className="md:hidden px-4 sm:px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              className="w-full bg-gray-50 border-gray-200 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:border-transparent placeholder:text-gray-400"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ '--tw-ring-color': primaryColor } as any}
            />
          </div>
        </div>

        {/* Navegação de Categorias */}
        <div className="border-t border-gray-200 bg-white/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              ref={categoryScrollRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide py-3 scroll-smooth"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0",
                  selectedCategory === 'all'
                    ? "text-white shadow-md"
                    : "text-gray-700 hover:bg-gray-100 bg-white"
                )}
                style={selectedCategory === 'all' ? { backgroundColor: primaryColor } : {}}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0",
                    selectedCategory === cat
                      ? "text-white shadow-md"
                      : "text-gray-700 hover:bg-gray-100 bg-white"
                  )}
                  style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Banner Hero */}
      {tenant.logo && (
        <div className="relative h-48 sm:h-64 bg-gradient-to-r from-gray-900 to-gray-800 overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative h-full flex items-center justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <img 
              src={tenant.logo} 
              alt={tenant.name} 
              className="h-24 sm:h-32 w-auto object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Título e Descrição */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-gray-900">
            {currentCategory}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl leading-relaxed">
            Descubra nossos sabores cuidadosamente preparados. Cada item é feito com ingredientes selecionados e muito carinho.
          </p>
        </div>

        {/* Grid de Produtos */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-24">
            <ChefHat className="h-20 w-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-bold mb-3 text-gray-900">
              {searchTerm ? 'Nenhum produto encontrado' : 'Cardápio em breve...'}
            </h3>
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'Tente buscar por outro termo' : 'Estamos preparando algo especial para você!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {currentCategoryItems.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                primaryColor={primaryColor}
                menuSettings={menuSettings || {}}
                onCustomize={handleCustomize}
                onAddToCart={handleAddToCartForProductCard}
              />
            ))}
          </div>
        )}
      </main>

      {/* Product Customization Modal */}
      {customizingItem && (
        <ProductCustomizationModal
          item={customizingItem}
          primaryColor={primaryColor}
          secondaryColor={tenant.secondaryColor || '#ec4899'}
          open={!!customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={(size, additions, complements, fruits, quantity) => {
            if (customizingItem) {
              handleAddToCart(customizingItem, size, additions || [], complements || [], quantity || 1, fruits)
            }
            setCustomizingItem(null)
          }}
        />
      )}

      {/* Cart Page */}
      <CartSidebar
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={Array.from(selectedItems.values())}
        total={totalCart}
        primaryColor={primaryColor}
        secondaryColor={tenant.secondaryColor || '#ec4899'}
        onRemoveItem={(id) => {
          setSelectedItems((prev) => {
            const newMap = new Map(prev)
            newMap.delete(id)
            return newMap
          })
        }}
        onUpdateQuantity={(id, quantity) => {
          setSelectedItems((prev) => {
            const newMap = new Map(prev)
            const item = newMap.get(id)
            if (item) {
              newMap.set(id, { ...item, quantity })
            }
            return newMap
          })
        }}
        allowWhatsAppOrder={menuSettings?.allowWhatsAppOrder}
        whatsAppNumber={menuSettings?.whatsAppNumber}
        customMessage={menuSettings?.customMessage}
        tenantId={tenant?.id}
        tenantName={tenant?.name}
        onCreateOrder={() => {
          setSelectedItems(new Map())
          setCartOpen(false)
        }}
      />
    </div>
  )
}

interface ProductCardProps {
  item: MenuItem
  primaryColor: string
  menuSettings: any
  onCustomize: (item: MenuItem) => void
  onAddToCart: (item: MenuItem, size?: SizeOption, additions?: Addition[], complements?: Complement[], quantity?: number, fruits?: Fruit[]) => void
}

function ProductCard({ item, primaryColor, menuSettings, onCustomize, onAddToCart }: ProductCardProps) {
  const [imageError, setImageError] = useState(false)

  const hasOptions = item.sizes.length > 0 || item.additions.length > 0 || item.complements.length > 0 || (item.fruits && item.fruits.length > 0)
  const minPrice = item.sizes.length > 0 
    ? Math.min(...item.sizes.map(s => s.price))
    : item.basePrice

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col">
      {/* Imagem do Produto */}
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {item.image && !imageError ? (
          <>
            <div
              className="absolute inset-0 bg-center bg-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
              style={{ backgroundImage: `url(${item.image})` }}
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ChefHat className="h-20 w-20 text-gray-300" />
          </div>
        )}
        {/* Tag de Preço */}
        {menuSettings?.showPrices !== false && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
            <p className="font-bold text-base" style={{ color: primaryColor }}>
              {item.sizes.length > 0 ? `A partir de ${formatCurrency(minPrice)}` : formatCurrency(item.basePrice)}
            </p>
          </div>
        )}
      </div>

      {/* Informações do Produto */}
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        <h3 className="text-xl font-bold mb-2 text-gray-900 leading-tight">{item.name}</h3>
        {menuSettings?.showDescriptions !== false && item.description && (
          <p className="text-gray-600 text-sm leading-relaxed mb-5 line-clamp-2 flex-1">
            {item.description}
          </p>
        )}
        {/* Botão de Ação */}
        <button
          onClick={() => {
            if (hasOptions) {
              onCustomize(item)
            } else {
              onAddToCart(item)
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md text-base mt-auto"
          style={{
            backgroundColor: primaryColor,
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <Plus className="h-5 w-5" />
          {hasOptions ? 'Personalizar' : 'Adicionar ao Pedido'}
        </button>
      </div>
    </div>
  )
}
