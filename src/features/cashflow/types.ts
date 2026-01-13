export type TransactionType = 'income' | 'expense'

export const transactionCategories = {
  income: [
    'Vendas',
    'Pedidos Delivery',
    'Pedidos Balcão',
    'Outros',
  ],
  expense: [
    'Compra de Ingredientes',
    'Aluguel',
    'Salários',
    'Energia',
    'Água',
    'Internet',
    'Marketing',
    'Manutenção',
    'Outros',
  ],
} as const

