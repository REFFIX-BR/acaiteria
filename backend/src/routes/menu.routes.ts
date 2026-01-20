import express from 'express'
import { z } from 'zod'
import { query } from '../db/connection.js'
import { authenticate, tenantGuard, AuthRequest } from '../middleware/auth.js'

const router = express.Router()

// Rota pública: buscar menu por slug do tenant
router.get('/public/:tenantSlug', async (req, res, next) => {
  try {
    // Primeiro busca o tenant pelo slug
    const tenantResult = await query(
      'SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL',
      [req.params.tenantSlug]
    )

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' })
    }

    const tenantId = tenantResult.rows[0].id

    // Busca os itens do menu disponíveis (apenas os que estão available = true)
    const result = await query(
      `SELECT mi.*,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mis.id, 'name', mis.name, 'price', mis.price))
         FILTER (WHERE mis.id IS NOT NULL),
         '[]'
       ) as sizes,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mia.id, 'name', mia.name, 'price', mia.price))
         FILTER (WHERE mia.id IS NOT NULL),
         '[]'
       ) as additions,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mic.id, 'name', mic.name, 'price', mic.price))
         FILTER (WHERE mic.id IS NOT NULL),
         '[]'
       ) as complements,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mif.id, 'name', mif.name, 'price', mif.price))
         FILTER (WHERE mif.id IS NOT NULL),
         '[]'
       ) as fruits
       FROM menu_items mi
       LEFT JOIN menu_item_sizes mis ON mi.id = mis.menu_item_id
       LEFT JOIN menu_item_additions mia ON mi.id = mia.menu_item_id
       LEFT JOIN menu_item_complements mic ON mi.id = mic.menu_item_id
       LEFT JOIN menu_item_fruits mif ON mi.id = mif.menu_item_id
       WHERE mi.tenant_id = $1 AND mi.available = true AND mi.deleted_at IS NULL
       GROUP BY mi.id
       ORDER BY mi.created_at DESC`,
      [tenantId]
    )

    res.json({ items: result.rows })
  } catch (error) {
    next(error)
  }
})

// Aplicar autenticação nas rotas protegidas
router.use(authenticate)
router.use(tenantGuard)

// Listar itens do cardápio
router.get('/items', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT mi.*,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mis.id, 'name', mis.name, 'price', mis.price))
         FILTER (WHERE mis.id IS NOT NULL),
         '[]'
       ) as sizes,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mia.id, 'name', mia.name, 'price', mia.price))
         FILTER (WHERE mia.id IS NOT NULL),
         '[]'
       ) as additions,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mic.id, 'name', mic.name, 'price', mic.price))
         FILTER (WHERE mic.id IS NOT NULL),
         '[]'
       ) as complements,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mif.id, 'name', mif.name, 'price', mif.price))
         FILTER (WHERE mif.id IS NOT NULL),
         '[]'
       ) as fruits
       FROM menu_items mi
       LEFT JOIN menu_item_sizes mis ON mi.id = mis.menu_item_id
       LEFT JOIN menu_item_additions mia ON mi.id = mia.menu_item_id
       LEFT JOIN menu_item_complements mic ON mi.id = mic.menu_item_id
       LEFT JOIN menu_item_fruits mif ON mi.id = mif.menu_item_id
       WHERE mi.tenant_id = $1 AND mi.deleted_at IS NULL
       GROUP BY mi.id
       ORDER BY mi.created_at DESC`,
      [req.user!.tenantId]
    )

    res.json({ items: result.rows })
  } catch (error) {
    next(error)
  }
})

// Buscar item por ID
router.get('/items/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT mi.*,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mis.id, 'name', mis.name, 'price', mis.price))
         FILTER (WHERE mis.id IS NOT NULL),
         '[]'
       ) as sizes,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mia.id, 'name', mia.name, 'price', mia.price))
         FILTER (WHERE mia.id IS NOT NULL),
         '[]'
       ) as additions,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mic.id, 'name', mic.name, 'price', mic.price))
         FILTER (WHERE mic.id IS NOT NULL),
         '[]'
       ) as complements,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mif.id, 'name', mif.name, 'price', mif.price))
         FILTER (WHERE mif.id IS NOT NULL),
         '[]'
       ) as fruits
       FROM menu_items mi
       LEFT JOIN menu_item_sizes mis ON mi.id = mis.menu_item_id
       LEFT JOIN menu_item_additions mia ON mi.id = mia.menu_item_id
       LEFT JOIN menu_item_complements mic ON mi.id = mic.menu_item_id
       LEFT JOIN menu_item_fruits mif ON mi.id = mif.menu_item_id
       WHERE mi.id = $1 AND mi.tenant_id = $2 AND mi.deleted_at IS NULL
       GROUP BY mi.id`,
      [req.params.id, req.user!.tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    res.json({ item: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

// Criar item
const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  basePrice: z.number().min(0),
  image: z.string().nullish(),
  images: z.array(z.string()).optional(),
  category: z.string().min(1),
  available: z.boolean(),
  maxAdditions: z.number().nullish(),
  maxComplements: z.number().nullish(),
  maxFruits: z.number().nullish(),
  freeAdditions: z.number().min(0).optional(),
  freeComplements: z.number().min(0).optional(),
  freeFruits: z.number().min(0).optional(),
  sizes: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional(),
  additions: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional(),
  complements: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional(),
  fruits: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).optional(),
})

router.post('/items', async (req: AuthRequest, res, next) => {
  try {
    const data = createItemSchema.parse(req.body)
    const normalizedImages = data.images && data.images.length > 0
      ? data.images
      : data.image
        ? [data.image]
        : []
    const primaryImage = normalizedImages[0] || null

    // Criar item
    const insertResult = await query(
      `INSERT INTO menu_items (tenant_id, name, description, base_price, image, images, category, available, max_additions, max_complements, max_fruits, free_additions, free_complements, free_fruits, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING id`,
      [
        req.user!.tenantId,
        data.name,
        data.description,
        data.basePrice,
        primaryImage,
        normalizedImages.length > 0 ? normalizedImages : null,
        data.category,
        data.available,
        data.maxAdditions || null,
        data.maxComplements || null,
        data.maxFruits || null,
        data.freeAdditions ?? 0,
        data.freeComplements ?? 0,
        data.freeFruits ?? 0,
      ]
    )

    const itemId = insertResult.rows[0].id

    // Criar tamanhos
    if (data.sizes && data.sizes.length > 0) {
      for (const size of data.sizes) {
        await query(
          'INSERT INTO menu_item_sizes (menu_item_id, name, price) VALUES ($1, $2, $3)',
          [itemId, size.name, size.price]
        )
      }
    }

    // Criar coberturas
    if (data.additions && data.additions.length > 0) {
      for (const addition of data.additions) {
        await query(
          'INSERT INTO menu_item_additions (menu_item_id, name, price) VALUES ($1, $2, $3)',
          [itemId, addition.name, addition.price]
        )
      }
    }

    // Criar complementos
    if (data.complements && data.complements.length > 0) {
      for (const complement of data.complements) {
        await query(
          'INSERT INTO menu_item_complements (menu_item_id, name, price) VALUES ($1, $2, $3)',
          [itemId, complement.name, complement.price]
        )
      }
    }

    // Criar frutas
    if (data.fruits && data.fruits.length > 0) {
      for (const fruit of data.fruits) {
        await query(
          'INSERT INTO menu_item_fruits (menu_item_id, name, price) VALUES ($1, $2, $3)',
          [itemId, fruit.name, fruit.price]
        )
      }
    }

    // Busca o item completo criado para retornar
    const fullItemResult = await query(
      `SELECT mi.*,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mis.id, 'name', mis.name, 'price', mis.price))
         FILTER (WHERE mis.id IS NOT NULL),
         '[]'
       ) as sizes,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mia.id, 'name', mia.name, 'price', mia.price))
         FILTER (WHERE mia.id IS NOT NULL),
         '[]'
       ) as additions,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mic.id, 'name', mic.name, 'price', mic.price))
         FILTER (WHERE mic.id IS NOT NULL),
         '[]'
       ) as complements,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object('id', mif.id, 'name', mif.name, 'price', mif.price))
         FILTER (WHERE mif.id IS NOT NULL),
         '[]'
       ) as fruits
       FROM menu_items mi
       LEFT JOIN menu_item_sizes mis ON mi.id = mis.menu_item_id
       LEFT JOIN menu_item_additions mia ON mi.id = mia.menu_item_id
       LEFT JOIN menu_item_complements mic ON mi.id = mic.menu_item_id
       LEFT JOIN menu_item_fruits mif ON mi.id = mif.menu_item_id
       WHERE mi.id = $1
       GROUP BY mi.id`,
      [itemId]
    )

    res.status(201).json({ item: fullItemResult.rows[0], message: 'Item created successfully' })
  } catch (error) {
    next(error)
  }
})

// Atualizar item
router.put('/items/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = createItemSchema.partial().parse(req.body)

    // Verificar se item existe e pertence ao tenant
    const check = await query(
      'SELECT id FROM menu_items WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.user!.tenantId]
    )

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    // Atualizar item
    if (Object.keys(data).length > 0) {
      const updates: string[] = []
      const values: any[] = []
      let paramCount = 1

      if (data.name) {
        updates.push(`name = $${paramCount++}`)
        values.push(data.name)
      }
      if (data.description) {
        updates.push(`description = $${paramCount++}`)
        values.push(data.description)
      }
      if (data.basePrice !== undefined) {
        updates.push(`base_price = $${paramCount++}`)
        values.push(data.basePrice)
      }
      if (data.images !== undefined) {
        updates.push(`images = $${paramCount++}`)
        values.push(data.images && data.images.length > 0 ? data.images : null)
        updates.push(`image = $${paramCount++}`)
        values.push(data.images && data.images.length > 0 ? data.images[0] : null)
      } else if (data.image !== undefined) {
        updates.push(`image = $${paramCount++}`)
        values.push(data.image)
        updates.push(`images = $${paramCount++}`)
        values.push(data.image ? [data.image] : null)
      }
      if (data.category) {
        updates.push(`category = $${paramCount++}`)
        values.push(data.category)
      }
      if (data.available !== undefined) {
        updates.push(`available = $${paramCount++}`)
        values.push(data.available)
      }
      if (data.maxAdditions !== undefined) {
        updates.push(`max_additions = $${paramCount++}`)
        values.push(data.maxAdditions)
      }
      if (data.maxComplements !== undefined) {
        updates.push(`max_complements = $${paramCount++}`)
        values.push(data.maxComplements)
      }
      if (data.maxFruits !== undefined) {
        updates.push(`max_fruits = $${paramCount++}`)
        values.push(data.maxFruits)
      }
      if (data.freeAdditions !== undefined) {
        updates.push(`free_additions = $${paramCount++}`)
        values.push(data.freeAdditions)
      }
      if (data.freeComplements !== undefined) {
        updates.push(`free_complements = $${paramCount++}`)
        values.push(data.freeComplements)
      }
      if (data.freeFruits !== undefined) {
        updates.push(`free_fruits = $${paramCount++}`)
        values.push(data.freeFruits)
      }

      updates.push(`updated_at = NOW()`)
      values.push(req.params.id, req.user!.tenantId)

      await query(
        `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}`,
        values
      )

      // Atualizar relacionamentos se fornecidos
      if (data.sizes !== undefined) {
        // Remove tamanhos existentes
        await query('DELETE FROM menu_item_sizes WHERE menu_item_id = $1', [req.params.id])
        // Adiciona novos tamanhos
        if (data.sizes.length > 0) {
          for (const size of data.sizes) {
            await query(
              'INSERT INTO menu_item_sizes (menu_item_id, name, price) VALUES ($1, $2, $3)',
              [req.params.id, size.name, size.price]
            )
          }
        }
      }

      if (data.additions !== undefined) {
        // Remove coberturas existentes
        await query('DELETE FROM menu_item_additions WHERE menu_item_id = $1', [req.params.id])
        // Adiciona novas coberturas
        if (data.additions.length > 0) {
          for (const addition of data.additions) {
            await query(
              'INSERT INTO menu_item_additions (menu_item_id, name, price) VALUES ($1, $2, $3)',
              [req.params.id, addition.name, addition.price]
            )
          }
        }
      }

      if (data.complements !== undefined) {
        // Remove complementos existentes
        await query('DELETE FROM menu_item_complements WHERE menu_item_id = $1', [req.params.id])
        // Adiciona novos complementos
        if (data.complements.length > 0) {
          for (const complement of data.complements) {
            await query(
              'INSERT INTO menu_item_complements (menu_item_id, name, price) VALUES ($1, $2, $3)',
              [req.params.id, complement.name, complement.price]
            )
          }
        }
      }

      if (data.fruits !== undefined) {
        // Remove frutas existentes
        await query('DELETE FROM menu_item_fruits WHERE menu_item_id = $1', [req.params.id])
        // Adiciona novas frutas
        if (data.fruits.length > 0) {
          for (const fruit of data.fruits) {
            await query(
              'INSERT INTO menu_item_fruits (menu_item_id, name, price) VALUES ($1, $2, $3)',
              [req.params.id, fruit.name, fruit.price]
            )
          }
        }
      }

      // Busca o item completo atualizado para retornar
      const itemResult = await query(
        `SELECT mi.*,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', mis.id, 'name', mis.name, 'price', mis.price))
           FILTER (WHERE mis.id IS NOT NULL),
           '[]'
         ) as sizes,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', mia.id, 'name', mia.name, 'price', mia.price))
           FILTER (WHERE mia.id IS NOT NULL),
           '[]'
         ) as additions,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', mic.id, 'name', mic.name, 'price', mic.price))
           FILTER (WHERE mic.id IS NOT NULL),
           '[]'
         ) as complements,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', mif.id, 'name', mif.name, 'price', mif.price))
           FILTER (WHERE mif.id IS NOT NULL),
           '[]'
         ) as fruits
         FROM menu_items mi
         LEFT JOIN menu_item_sizes mis ON mi.id = mis.menu_item_id
         LEFT JOIN menu_item_additions mia ON mi.id = mia.menu_item_id
         LEFT JOIN menu_item_complements mic ON mi.id = mic.menu_item_id
         LEFT JOIN menu_item_fruits mif ON mi.id = mif.menu_item_id
         WHERE mi.id = $1 AND mi.tenant_id = $2
         GROUP BY mi.id`,
        [req.params.id, req.user!.tenantId]
      )

      if (itemResult.rows.length > 0) {
        return res.json({ item: itemResult.rows[0], message: 'Item updated successfully' })
      }
    }

    res.json({ message: 'Item updated successfully' })
  } catch (error) {
    next(error)
  }
})

// Deletar item (soft delete)
router.delete('/items/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      'UPDATE menu_items SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id',
      [req.params.id, req.user!.tenantId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    res.json({ message: 'Item deleted successfully' })
  } catch (error) {
    next(error)
  }
})

export { router as menuRoutes }

