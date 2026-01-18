import express from 'express'
import { z } from 'zod'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'
import {
  getAllDeliveryFees,
  getDeliveryFeeByNeighborhood,
  createDeliveryFee,
  updateDeliveryFee,
  deleteDeliveryFee,
} from '../db/storage.js'
import { fetchAddressByCEP } from '../lib/cep/viacep.js'

const router = express.Router()

// Schema de validação
const createDeliveryFeeSchema = z.object({
  neighborhood: z.string().min(1, 'Nome do bairro é obrigatório'),
  fee: z.number().min(0, 'Taxa deve ser maior ou igual a zero'),
})

const updateDeliveryFeeSchema = z.object({
  neighborhood: z.string().min(1).optional(),
  fee: z.number().min(0).optional(),
})

// Rotas públicas (sem autenticação) para busca por CEP e bairro
// Essas rotas são usadas pelo cardápio público

/**
 * GET /api/delivery-fees/by-cep/:cep
 * Busca taxa de entrega por CEP (público)
 * Primeiro busca o bairro via ViaCEP, depois busca a taxa
 */
router.get('/by-cep/:cep', async (req, res, next) => {
  try {
    const { cep } = req.params
    const tenantId = req.query.tenantId as string

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId é obrigatório',
      })
    }

    // Busca endereço via ViaCEP
    const addressInfo = await fetchAddressByCEP(cep)

    if (!addressInfo) {
      return res.json({
        success: true,
        neighborhood: null,
        fee: 0,
        message: 'CEP não encontrado ou sem bairro cadastrado',
      })
    }

    // Busca taxa de entrega pelo bairro
    const deliveryFee = await getDeliveryFeeByNeighborhood(tenantId, addressInfo.neighborhood)

    res.json({
      success: true,
      neighborhood: addressInfo.neighborhood,
      city: addressInfo.city,
      state: addressInfo.state,
      address: addressInfo.address,
      fee: deliveryFee ? deliveryFee.fee : 0,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/delivery-fees/by-neighborhood/:neighborhood
 * Busca taxa de entrega por bairro (público)
 */
router.get('/by-neighborhood/:neighborhood', async (req, res, next) => {
  try {
    const { neighborhood } = req.params
    const tenantId = req.query.tenantId as string

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId é obrigatório',
      })
    }

    const deliveryFee = await getDeliveryFeeByNeighborhood(tenantId, neighborhood)

    res.json({
      success: true,
      neighborhood,
      fee: deliveryFee ? deliveryFee.fee : 0,
    })
  } catch (error) {
    next(error)
  }
})

// Rotas protegidas (requerem autenticação)
router.use(authenticate)
router.use(tenantGuard)

/**
 * GET /api/delivery-fees
 * Lista todas as taxas de entrega do tenant
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' })
    }

    const deliveryFees = await getAllDeliveryFees(req.user.tenantId)

    res.json({
      success: true,
      deliveryFees,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/delivery-fees
 * Cria uma nova taxa de entrega
 */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' })
    }

    const validation = createDeliveryFeeSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.errors,
      })
    }

    const { neighborhood, fee } = validation.data

    // Verificar se já existe taxa para este bairro
    const existing = await getDeliveryFeeByNeighborhood(req.user.tenantId, neighborhood)

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Já existe uma taxa configurada para este bairro',
      })
    }

    const deliveryFee = await createDeliveryFee({
      tenantId: req.user.tenantId,
      neighborhood,
      fee,
    })

    res.status(201).json({
      success: true,
      deliveryFee,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * PUT /api/delivery-fees/:id
 * Atualiza uma taxa de entrega
 */
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' })
    }

    const validation = updateDeliveryFeeSchema.safeParse(req.body)

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: validation.error.errors,
      })
    }

    const { id } = req.params
    const { neighborhood, fee } = validation.data

    // Se estiver atualizando o bairro, verificar se não existe outro com o mesmo nome
    if (neighborhood) {
      const existing = await getDeliveryFeeByNeighborhood(req.user.tenantId, neighborhood)
      if (existing && existing.id !== id) {
        return res.status(409).json({
          success: false,
          error: 'Já existe uma taxa configurada para este bairro',
        })
      }
    }

    const deliveryFee = await updateDeliveryFee(id, { neighborhood, fee })

    res.json({
      success: true,
      deliveryFee,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Taxa de entrega não encontrada') {
      return res.status(404).json({
        success: false,
        error: 'Taxa de entrega não encontrada',
      })
    }
    next(error)
  }
})

/**
 * DELETE /api/delivery-fees/:id
 * Deleta uma taxa de entrega (soft delete)
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Não autenticado' })
    }

    const { id } = req.params

    await deleteDeliveryFee(id)

    res.json({
      success: true,
      message: 'Taxa de entrega deletada com sucesso',
    })
  } catch (error) {
    next(error)
  }
})

export { router as deliveryFeeRoutes }

