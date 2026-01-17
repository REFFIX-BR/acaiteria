import express from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'
import { uploadToS3, isS3Enabled, getS3PublicUrl } from '../lib/storage/s3Client.js'

const router = express.Router()

// Configurar multer para armazenar em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas imagens
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de arquivo não permitido. Apenas imagens são aceitas.'))
    }
  },
})

const uploadSchema = z.object({
  type: z.enum(['logo', 'menu-item']),
})

// Rota pública para upload (usando tenant slug)
router.post('/public/:tenantSlug', upload.single('image'), async (req, res, next) => {
  try {
    if (!isS3Enabled()) {
      return res.status(503).json({ error: 'Upload de imagens não está disponível' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    const { tenantSlug } = req.params
    const { type } = uploadSchema.parse(req.body)

    // Buscar tenant_id pelo slug
    const { query } = await import('../db/connection.js')
    const tenantResult = await query(
      'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [tenantSlug]
    )

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const tenantId = tenantResult.rows[0].id

    // Sanitizar nome do arquivo
    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const extension = originalName.split('.').pop() || 'jpg'
    const fileName = `${timestamp}-${originalName}`

    // Definir path baseado no tipo
    const folder = type === 'logo' ? 'logos' : 'menu-items'
    const key = `${tenantId}/${folder}/${fileName}`

    // Fazer upload para S3
    const bucket = process.env.S3_BUCKET || 'acaiteria'
    const url = await uploadToS3({
      bucket,
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    })

    res.json({ url, key })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Tipo inválido. Use "logo" ou "menu-item"' })
    }
    next(error)
  }
})

// Rota autenticada para upload
router.post('/', authenticate, tenantGuard, upload.single('image'), async (req: AuthRequest, res, next) => {
  try {
    if (!isS3Enabled()) {
      return res.status(503).json({ error: 'Upload de imagens não está disponível' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    const { type } = uploadSchema.parse(req.body)
    const tenantId = req.user!.tenantId

    // Sanitizar nome do arquivo
    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = Date.now()
    const extension = originalName.split('.').pop() || 'jpg'
    const fileName = `${timestamp}-${originalName}`

    // Definir path baseado no tipo
    const folder = type === 'logo' ? 'logos' : 'menu-items'
    const key = `${tenantId}/${folder}/${fileName}`

    // Fazer upload para S3
    const bucket = process.env.S3_BUCKET || 'acaiteria'
    const url = await uploadToS3({
      bucket,
      key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    })

    res.json({ url, key })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Tipo inválido. Use "logo" ou "menu-item"' })
    }
    next(error)
  }
})

export { router as uploadRoutes }

