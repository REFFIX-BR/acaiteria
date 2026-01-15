import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { errorHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/auth.routes.js'
import { tenantRoutes } from './routes/tenant.routes.js'
import { menuRoutes } from './routes/menu.routes.js'
import { orderRoutes } from './routes/order.routes.js'
import { transactionRoutes } from './routes/transaction.routes.js'
import { productRoutes } from './routes/product.routes.js'
import { campaignRoutes } from './routes/campaign.routes.js'
import { customerRoutes } from './routes/customer.routes.js'
import { dashboardRoutes } from './routes/dashboard.routes.js'
import { settingsRoutes } from './routes/settings.routes.js'
import paymentRoutes from './routes/payment.routes.js'
import paghiperRoutes from './routes/paghiper.routes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Configurar trust proxy para funcionar corretamente com Traefik
// Isso permite que o Express confie nos headers X-Forwarded-* do proxy reverso
app.set('trust proxy', true)

// Middleware de log para TODAS as requisições (ANTES de qualquer coisa)
// Nota: req.body ainda não está disponível aqui (body parser vem depois)
app.use((req, res, next) => {
  try {
    console.log('[Request]', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      headers: {
        authorization: req.headers.authorization ? 'present' : 'missing',
        'content-type': req.headers['content-type'],
        host: req.headers.host,
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent']?.substring(0, 50) || 'N/A',
      },
    })
  } catch (error) {
    // Se houver erro no log, não quebra a requisição
    console.error('[Request] Erro ao fazer log:', error)
  }
  next()
})

// Middleware de segurança
app.use(helmet())

// Configuração CORS - aceitar múltiplas origens
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://gestaoloja.reffix.com.br',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (ex: Postman, curl)
    if (!origin) return callback(null, true)
    
    // Se não há origens permitidas configuradas ou se a origem está na lista
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn('[CORS] Origem não permitida:', origin)
      callback(null, true) // Por enquanto, permitir todas para debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}))

// Rate limiting (mais permissivo para não bloquear requisições)
// Configurar trust proxy corretamente para evitar avisos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // aumentado para não bloquear
  standardHeaders: true,
  legacyHeaders: false,
  // Configurar para usar IP real quando atrás de proxy
  keyGenerator: (req) => {
    // Usar X-Forwarded-For se disponível, senão usar IP direto
    const forwarded = req.headers['x-forwarded-for']
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim()
    }
    return req.ip || req.socket.remoteAddress || 'unknown'
  },
})
app.use('/api/', limiter)

// Body parser
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/tenants', tenantRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/products', productRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/settings', settingsRoutes)
// Rotas de pagamento (checkout e status)
console.log('📋 Registrando rota /api/payment')
app.use('/api/payment', paymentRoutes)
// Webhook PagHiper (precisa estar em /api/paghiper/webhook)
console.log('📋 Registrando rota /api/paghiper')
app.use('/api/paghiper', paghiperRoutes)

// Debug: Log de todas as rotas registradas
console.log('📋 Rotas registradas:')
console.log('  - /api/payment/* (paymentRoutes)')
console.log('  - /api/paghiper/* (paghiperRoutes)')

// Error handler
app.use(errorHandler)

// 404 handler
app.use((req, res) => {
  console.log('[404] Rota não encontrada:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
  })
  res.status(404).json({ error: 'Route not found', path: req.path, method: req.method })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
})


