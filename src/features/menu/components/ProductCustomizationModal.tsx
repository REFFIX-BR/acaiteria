import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Minus, X, ArrowLeft, ChefHat } from 'lucide-react'
import type { MenuItem, SizeOption, Addition, Complement, Fruit } from '@/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

interface ProductCustomizationModalProps {
  item: MenuItem
  primaryColor: string
  secondaryColor: string
  open: boolean
  onClose: () => void
  onAddToCart: (
    size?: SizeOption,
    additions?: Addition[],
    complements?: Complement[],
    fruits?: Fruit[],
    quantity?: number
  ) => void
}

export function ProductCustomizationModal({
  item,
  primaryColor,
  secondaryColor,
  open,
  onClose,
  onAddToCart,
}: ProductCustomizationModalProps) {
  const { toast } = useToast()
  const [selectedSize, setSelectedSize] = useState<SizeOption | undefined>(undefined)
  const [selectedAdditions, setSelectedAdditions] = useState<Addition[]>([])
  const [selectedComplements, setSelectedComplements] = useState<Complement[]>([])
  const [selectedFruits, setSelectedFruits] = useState<Fruit[]>([])
  const [quantity, setQuantity] = useState(1)
  const [observations, setObservations] = useState('')
  const carouselRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = item.images && item.images.length > 0
    ? item.images
    : item.image
      ? [item.image]
      : []

  // Reset state when item changes
  useEffect(() => {
    if (open) {
      setSelectedSize(item.sizes.length > 0 ? item.sizes[0] : undefined)
      setSelectedAdditions([])
      setSelectedComplements([])
      setSelectedFruits([])
      setQuantity(1)
      setObservations('')
      setCurrentIndex(0)
    }
  }, [item.id, open])

  useEffect(() => {
    if (!open || images.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [open, images.length])

  useEffect(() => {
    if (!carouselRef.current || images.length <= 1) return
    const width = carouselRef.current.clientWidth
    carouselRef.current.scrollTo({ left: width * currentIndex, behavior: 'smooth' })
  }, [currentIndex, images.length])

  const calculateExtrasTotal = (items: Array<{ price: number }>, freeCount?: number) => {
    const freeLimit = Math.max(0, freeCount || 0)
    return items.reduce((total, current, index) => {
      if (index < freeLimit) return total
      return total + current.price
    }, 0)
  }

  const calculateTotal = () => {
    // Se tem tamanhos e um tamanho foi selecionado, usa o preço do tamanho
    // Se não tem tamanhos, usa o preço base
    let total = selectedSize ? selectedSize.price : item.basePrice
    total += calculateExtrasTotal(selectedAdditions, item.freeAdditions)
    total += calculateExtrasTotal(selectedComplements, item.freeComplements)
    total += calculateExtrasTotal(selectedFruits, item.freeFruits)
    return total * quantity
  }

  const calculateUnitPrice = () => {
    // Se tem tamanhos e um tamanho foi selecionado, usa o preço do tamanho
    // Se não tem tamanhos, usa o preço base
    let total = selectedSize ? selectedSize.price : item.basePrice
    total += calculateExtrasTotal(selectedAdditions, item.freeAdditions)
    total += calculateExtrasTotal(selectedComplements, item.freeComplements)
    total += calculateExtrasTotal(selectedFruits, item.freeFruits)
    return total
  }

  const toggleAddition = (addition: Addition) => {
    setSelectedAdditions((prev) => {
      const exists = prev.find((a) => a.id === addition.id)
      if (exists) {
        return prev.filter((a) => a.id !== addition.id)
      }
      // Verifica limite de coberturas
      if (item.maxAdditions && prev.length >= item.maxAdditions) {
        toast({
          title: 'Limite atingido',
          description: `Você pode selecionar no máximo ${item.maxAdditions} cobertura${item.maxAdditions !== 1 ? 's' : ''}.`,
          variant: 'destructive',
        })
        return prev // Não adiciona se já atingiu o limite
      }
      return [...prev, addition]
    })
  }

  const toggleComplement = (complement: Complement) => {
    setSelectedComplements((prev) => {
      const exists = prev.find((c) => c.id === complement.id)
      if (exists) {
        return prev.filter((c) => c.id !== complement.id)
      }
      // Verifica limite de complementos
      if (item.maxComplements && prev.length >= item.maxComplements) {
        toast({
          title: 'Limite atingido',
          description: `Você pode selecionar no máximo ${item.maxComplements} complemento${item.maxComplements !== 1 ? 's' : ''}.`,
          variant: 'destructive',
        })
        return prev // Não adiciona se já atingiu o limite
      }
      return [...prev, complement]
    })
  }

  const toggleFruit = (fruit: Fruit) => {
    setSelectedFruits((prev) => {
      const exists = prev.find((f) => f.id === fruit.id)
      if (exists) {
        return prev.filter((f) => f.id !== fruit.id)
      }
      // Verifica limite de frutas
      if (item.maxFruits && prev.length >= item.maxFruits) {
        toast({
          title: 'Limite atingido',
          description: `Você pode selecionar no máximo ${item.maxFruits} fruta${item.maxFruits !== 1 ? 's' : ''}.`,
          variant: 'destructive',
        })
        return prev // Não adiciona se já atingiu o limite
      }
      return [...prev, fruit]
    })
  }

  const handleAddToCart = () => {
    onAddToCart(selectedSize, selectedAdditions, selectedComplements, selectedFruits, quantity)
  }

  // Ingredientes principais (mostra adições ou complementos como ingredientes)
  const keyIngredients = [
    ...item.additions.slice(0, 3).map(a => a.name),
    ...item.complements.slice(0, 2).map(c => c.name)
  ].filter(Boolean)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f7f6] overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#f8f7f6]/80 backdrop-blur-md px-4 sm:px-10 py-4 sm:py-6 flex items-center justify-between border-b border-[#f3ede7]">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[#9a734c] hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide uppercase hidden sm:inline">Voltar ao Cardápio</span>
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[#f3ede7] rounded-lg transition-colors"
        >
          <X className="h-5 w-5 text-[#1b140d]" />
        </button>
      </header>

      {/* Split Layout */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-73px)]">
        {/* Left Side - Image */}
        <div className="lg:w-1/2 relative h-[50vh] lg:h-full overflow-hidden">
          {images.length > 0 ? (
            <>
              <div className="absolute inset-0">
                <div ref={carouselRef} className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scroll-smooth">
                  {images.map((imageUrl, index) => (
                    <div key={`${imageUrl}-${index}`} className="min-w-full h-full snap-center">
                      <div
                        className="h-full w-full bg-center bg-cover"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#1b140d]/60 via-transparent to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#f3ede7] to-gray-300 flex items-center justify-center">
              <ChefHat className="h-32 w-32 text-gray-400" />
            </div>
          )}
          <div className="absolute bottom-10 left-10 hidden lg:block">
            <span
              className="px-3 py-1 text-white text-xs font-bold uppercase tracking-widest rounded mb-2 inline-block"
              style={{ backgroundColor: primaryColor }}
            >
              {item.category || 'Destaque'}
            </span>
            <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight drop-shadow-lg">{item.name}</h1>
          </div>
        </div>

        {/* Right Side - Content */}
        <div className="lg:w-1/2 p-6 sm:p-8 lg:p-12 xl:p-16 overflow-y-auto bg-[#f8f7f6] custom-scrollbar">
          <div className="max-w-3xl mx-auto">
            {/* Mobile Title and Price */}
            <div className="mb-6 lg:hidden">
              <div className="flex justify-between items-start mb-4 gap-4">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#1b140d] flex-1">{item.name}</h1>
                <div className="text-right">
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(calculateUnitPrice())}
                  </p>
                  {quantity > 1 && (
                    <p className="text-xs text-[#9a734c] mt-1">
                      {quantity}x = {formatCurrency(calculateTotal())}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Price */}
            <div className="hidden lg:flex justify-end mb-4">
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {formatCurrency(calculateUnitPrice())}
                </p>
                {quantity > 1 && (
                  <p className="text-sm text-[#9a734c] mt-1">
                    {quantity}x {formatCurrency(calculateUnitPrice())} = {formatCurrency(calculateTotal())}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-[#9a734c] text-base sm:text-lg leading-relaxed mb-8 italic">
                "{item.description}"
              </p>
            )}

            {/* Key Ingredients */}
            {(keyIngredients.length > 0 || item.description) && (
              <div className="space-y-4 mb-10">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#9a734c] border-b border-[#9a734c]/20 pb-2">
                  Informações do Produto
                </h3>
                {keyIngredients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keyIngredients.map((ingredient, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-[#2a2016]/5 rounded-full text-sm text-[#1b140d] font-medium"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleAddToCart()
              }}
              className="space-y-10"
            >
              {/* Sizes Section */}
              {item.sizes.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-[#1b140d]">
                    <ChefHat className="h-4 w-4" style={{ color: primaryColor }} />
                    Tamanho
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {item.sizes.map((size) => {
                      const isSelected = selectedSize?.id === size.id
                      return (
                        <label key={size.id} className="cursor-pointer group">
                          <input
                            type="radio"
                            name="size"
                            value={size.id}
                            checked={isSelected}
                            onChange={() => setSelectedSize(size)}
                            className="peer hidden"
                          />
                          <div
                            className={cn(
                              "p-4 border rounded-xl text-center transition-all",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-[#f3ede7] hover:bg-[#2a2016]/5"
                            )}
                            style={isSelected ? { borderColor: primaryColor } : {}}
                          >
                            <p className="text-sm font-semibold text-[#1b140d] mb-1">{size.name}</p>
                            {size.price > 0 && (
                              <p className="text-[10px] text-[#9a734c] uppercase">
                                +{formatCurrency(size.price)}
                              </p>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Additions Section */}
              {item.additions.length > 0 && (
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-[#1b140d]">
                      <ChefHat className="h-4 w-4" style={{ color: primaryColor }} />
                      Coberturas
                    </h3>
                    <div className="flex items-center gap-2">
                      {item.freeAdditions && item.freeAdditions > 0 && (
                        <span className="text-[10px] text-green-700 uppercase font-bold bg-green-100 px-2 py-0.5 rounded">
                          {item.freeAdditions} grátis
                        </span>
                      )}
                      {item.maxAdditions && (
                        <span className="text-[10px] text-[#9a734c] uppercase font-bold bg-[#9a734c]/10 px-2 py-0.5 rounded">
                          Máx. {item.maxAdditions}
                        </span>
                      )}
                      <span className="text-[10px] text-[#9a734c] uppercase font-bold bg-[#9a734c]/10 px-2 py-0.5 rounded">
                        Opcional
                      </span>
                    </div>
                  </div>
                  {item.maxAdditions && selectedAdditions.length >= item.maxAdditions && (
                    <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Limite atingido: você selecionou {selectedAdditions.length} de {item.maxAdditions} cobertura{item.maxAdditions !== 1 ? 's' : ''} permitida{item.maxAdditions !== 1 ? 's' : ''}.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {item.additions.map((addition) => {
                      const isSelected = selectedAdditions.some((a) => a.id === addition.id)
                      const isDisabled = !!(!isSelected && item.maxAdditions && selectedAdditions.length >= item.maxAdditions)
                      return (
                        <label
                          key={addition.id}
                          className={cn(
                            "flex items-center justify-between p-4 border rounded-xl transition-all",
                            isDisabled 
                              ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" 
                              : "border-[#f3ede7] cursor-pointer hover:bg-[#2a2016]/5"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAddition(addition)}
                              disabled={isDisabled}
                              className="w-5 h-5 rounded border-gray-300 disabled:cursor-not-allowed"
                              style={{
                                accentColor: primaryColor,
                              }}
                            />
                            <div>
                              <p className={cn(
                                "text-sm font-semibold",
                                isDisabled ? "text-gray-400" : "text-[#1b140d]"
                              )}>
                                {addition.name}
                              </p>
                            </div>
                          </div>
                          {addition.price > 0 && (
                            <p className={cn(
                              "text-sm font-bold",
                              isDisabled ? "text-gray-400" : ""
                            )} style={!isDisabled ? { color: primaryColor } : {}}>
                              +{formatCurrency(addition.price)}
                            </p>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Complements Section */}
              {item.complements.length > 0 && (
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-[#1b140d]">
                      <ChefHat className="h-4 w-4" style={{ color: primaryColor }} />
                      Complementos
                    </h3>
                    <div className="flex items-center gap-2">
                      {item.freeComplements && item.freeComplements > 0 && (
                        <span className="text-[10px] text-green-700 uppercase font-bold bg-green-100 px-2 py-0.5 rounded">
                          {item.freeComplements} grátis
                        </span>
                      )}
                      {item.maxComplements && (
                        <span className="text-[10px] text-[#9a734c] uppercase font-bold bg-[#9a734c]/10 px-2 py-0.5 rounded">
                          Máx. {item.maxComplements}
                        </span>
                      )}
                      <span className="text-[10px] text-[#9a734c] uppercase font-bold bg-[#9a734c]/10 px-2 py-0.5 rounded">
                        Opcional
                      </span>
                    </div>
                  </div>
                  {item.maxComplements && selectedComplements.length >= item.maxComplements && (
                    <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Limite atingido: você selecionou {selectedComplements.length} de {item.maxComplements} complemento{item.maxComplements !== 1 ? 's' : ''} permitido{item.maxComplements !== 1 ? 's' : ''}.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {item.complements.map((complement) => {
                      const isSelected = selectedComplements.some((c) => c.id === complement.id)
                      const isDisabled = !!(!isSelected && item.maxComplements && selectedComplements.length >= item.maxComplements)
                      return (
                        <label
                          key={complement.id}
                          className={cn(
                            "flex items-center justify-between p-4 border rounded-xl transition-all",
                            isDisabled 
                              ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" 
                              : "border-[#f3ede7] cursor-pointer hover:bg-[#2a2016]/5"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleComplement(complement)}
                              disabled={isDisabled}
                              className="w-5 h-5 rounded border-gray-300 disabled:cursor-not-allowed"
                              style={{
                                accentColor: primaryColor,
                              }}
                            />
                            <div>
                              <p className={cn(
                                "text-sm font-semibold",
                                isDisabled ? "text-gray-400" : "text-[#1b140d]"
                              )}>
                                {complement.name}
                              </p>
                            </div>
                          </div>
                          {complement.price > 0 && (
                            <p className={cn(
                              "text-sm font-bold",
                              isDisabled ? "text-gray-400" : ""
                            )} style={!isDisabled ? { color: primaryColor } : {}}>
                              +{formatCurrency(complement.price)}
                            </p>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Fruits Section */}
              {item.fruits && item.fruits.length > 0 && (
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-[#1b140d]">
                      <ChefHat className="h-4 w-4" style={{ color: primaryColor }} />
                      Frutas
                    </h3>
                    <div className="flex items-center gap-2">
                      {item.freeFruits && item.freeFruits > 0 && (
                        <span className="text-[10px] text-green-700 uppercase font-bold bg-green-100 px-2 py-0.5 rounded">
                          {item.freeFruits} grátis
                        </span>
                      )}
                      {item.maxFruits && (
                        <span className="text-[10px] text-[#9a734c] uppercase font-bold bg-[#9a734c]/10 px-2 py-0.5 rounded">
                          Máx. {item.maxFruits}
                        </span>
                      )}
                      <span className="text-[10px] text-[#9a734c] uppercase font-bold bg-[#9a734c]/10 px-2 py-0.5 rounded">
                        Opcional
                      </span>
                    </div>
                  </div>
                  {item.maxFruits && selectedFruits.length >= item.maxFruits && (
                    <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Limite atingido: você selecionou {selectedFruits.length} de {item.maxFruits} fruta{item.maxFruits !== 1 ? 's' : ''} permitida{item.maxFruits !== 1 ? 's' : ''}.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {item.fruits.map((fruit) => {
                      const isSelected = selectedFruits.some((f) => f.id === fruit.id)
                      const isDisabled = !!(!isSelected && item.maxFruits && selectedFruits.length >= item.maxFruits)
                      return (
                        <label
                          key={fruit.id}
                          className={cn(
                            "flex items-center justify-between p-4 border rounded-xl transition-all",
                            isDisabled 
                              ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed" 
                              : "border-[#f3ede7] cursor-pointer hover:bg-[#2a2016]/5"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFruit(fruit)}
                              disabled={isDisabled}
                              className="w-5 h-5 rounded border-gray-300 disabled:cursor-not-allowed"
                              style={{
                                accentColor: primaryColor,
                              }}
                            />
                            <div>
                              <p className={cn(
                                "text-sm font-semibold",
                                isDisabled ? "text-gray-400" : "text-[#1b140d]"
                              )}>
                                {fruit.name}
                              </p>
                            </div>
                          </div>
                          {fruit.price > 0 && (
                            <p className={cn(
                              "text-sm font-bold",
                              isDisabled ? "text-gray-400" : ""
                            )} style={!isDisabled ? { color: primaryColor } : {}}>
                              +{formatCurrency(fruit.price)}
                            </p>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Observations Section */}
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-[#1b140d]">
                  <ChefHat className="h-4 w-4" style={{ color: primaryColor }} />
                  Observações
                </h3>
                <Textarea
                  placeholder="Ex.: Menos açúcar, mais frutas, sem leite condensado, etc."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full min-h-[100px] bg-[#f3ede7] border-[#f3ede7] rounded-xl p-4 text-sm text-[#1b140d] placeholder:text-[#9a734c] focus:ring-1 focus:border-[#f3ede7]"
                  style={{ '--tw-ring-color': primaryColor } as any}
                />
              </section>

              {/* Quantity and Add Button */}
              <div className="pt-8 border-t border-[#f3ede7] flex flex-col sm:flex-row gap-6 items-center">
                <div className="flex items-center bg-[#f8f7f6] border border-[#f3ede7] rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors text-[#1b140d]"
                    style={{ '--hover-color': primaryColor } as any}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = primaryColor
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#1b140d'
                    }}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="text"
                    readOnly
                    value={quantity}
                    className="w-12 text-center bg-transparent border-none focus:ring-0 font-bold text-[#1b140d]"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:text-primary transition-colors text-[#1b140d]"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = primaryColor
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#1b140d'
                    }}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <button
                  type="submit"
                  className="flex-1 w-full py-4 px-8 rounded-xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-white"
                  style={{
                    backgroundColor: primaryColor,
                    boxShadow: `${primaryColor}33 0px 10px 40px`,
                  }}
                >
                  <Plus className="h-5 w-5" />
                  Adicionar ao Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
