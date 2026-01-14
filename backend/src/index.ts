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

// Middleware de segurança
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por IP
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
app.use('/api/payment', paymentRoutes)
// Webhook PagHiper (precisa estar em /api/paghiper/webhook)
app.use('/api/paghiper', paghiperRoutes)

// Error handler
app.use(errorHandler)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
})


