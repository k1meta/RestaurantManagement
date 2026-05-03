const express = require('express');
const pool    = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { parseAllowedUnit } = require('../constants/units');

const router = express.Router();
router.use(authenticate);

function parseOptionalNonNegativeThreshold(raw, fieldLabel, allowNullExplicit = true) {
  if (!Object.prototype.hasOwnProperty.call(raw, fieldLabel)) return undefined;
  const val = raw[fieldLabel];
  if (val === null || val === '') {
    return allowNullExplicit ? null : undefined;
  }
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${fieldLabel} must be a non-negative number` };
  }
  return { value: n };
}

function validateThresholdPair(low, full) {
  if (
    low != null &&
    full != null &&
    Number(low) > Number(full)
  ) {
    return 'low_stock_threshold cannot exceed full_stock_target';
  }
  return null;
}

// GET /api/inventory  — manager sees their location; owner sees all
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.user.role === 'owner') {
      result = await pool.query(
        `SELECT i.id,
                i.location_id,
                i.ingredient_id,
                COALESCE(ing.name, i.ingredient) AS ingredient,
                i.quantity,
                COALESCE(i.unit, ing.default_unit) AS unit,
                i.low_stock_threshold,
                i.full_stock_target,
                i.updated_at,
                l.name AS location_name
         FROM inventory i
         JOIN locations l ON i.location_id = l.id
         LEFT JOIN ingredients ing ON i.ingredient_id = ing.id
         ORDER BY l.name, COALESCE(ing.name, i.ingredient)`
      );
    } else {
      result = await pool.query(
        `SELECT i.id,
                i.location_id,
                i.ingredient_id,
                COALESCE(ing.name, i.ingredient) AS ingredient,
                i.quantity,
                COALESCE(i.unit, ing.default_unit) AS unit,
                i.low_stock_threshold,
                i.full_stock_target,
                i.updated_at,
                l.name AS location_name
         FROM inventory i
         JOIN locations l ON i.location_id = l.id
         LEFT JOIN ingredients ing ON i.ingredient_id = ing.id
         WHERE i.location_id = $1
         ORDER BY COALESCE(ing.name, i.ingredient)`,
        [req.user.location_id]
      );
    }
    res.json({ inventory: result.rows });
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory  — add or update an ingredient (manager / owner only)
// Body: { ingredient_id?, ingredient?, quantity, unit? }
router.post('/', authorize('manager', 'owner'), async (req, res) => {
  const { ingredient, quantity, unit, location_id } = req.body;
  const ingredientId = req.body.ingredient_id == null ? null : Number(req.body.ingredient_id);

  const lowParsed = parseOptionalNonNegativeThreshold(req.body, 'low_stock_threshold');
  if (lowParsed && lowParsed.error) {
    return res.status(400).json({ error: lowParsed.error });
  }
  const fullParsed = parseOptionalNonNegativeThreshold(req.body, 'full_stock_target');
  if (fullParsed && fullParsed.error) {
    return res.status(400).json({ error: fullParsed.error });
  }

  const nextLow = lowParsed === undefined ? undefined : lowParsed.value;
  const nextFull = fullParsed === undefined ? undefined : fullParsed.value;
  const pairErr = validateThresholdPair(nextLow, nextFull);
  if (pairErr) {
    return res.status(400).json({ error: pairErr });
  }

  // Owner can specify a location; manager defaults to their own
  const targetLocation = req.user.role === 'owner' && location_id != null
    ? Number(location_id)
    : req.user.location_id;

  if (!Number.isInteger(targetLocation) || targetLocation <= 0) {
    return res.status(400).json({ error: 'Valid location_id is required' });
  }

  if (quantity == null || !Number.isFinite(Number(quantity)) || Number(quantity) < 0) {
    return res.status(400).json({ error: 'quantity must be a non-negative number' });
  }

  if (!ingredientId && !String(ingredient || '').trim()) {
    return res.status(400).json({ error: 'ingredient_id or ingredient name is required' });
  }

  const unitParsed = parseAllowedUnit(unit);
  if (!unitParsed.ok) {
    return res.status(400).json({ error: unitParsed.error });
  }
  const normalizedUnit = unitParsed.value;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let resolvedIngredientId = ingredientId;
    let resolvedIngredientName = null;

    if (resolvedIngredientId) {
      const ingResult = await client.query('SELECT id, name FROM ingredients WHERE id = $1', [resolvedIngredientId]);
      if (!ingResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid ingredient_id' });
      }
      resolvedIngredientName = ingResult.rows[0].name;
    } else {
      const rawName = String(ingredient || '').trim();
      const created = await client.query(
        `INSERT INTO ingredients (name, default_unit)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET default_unit = COALESCE(EXCLUDED.default_unit, ingredients.default_unit)
         RETURNING id, name`,
        [rawName, normalizedUnit]
      );
      resolvedIngredientId = created.rows[0].id;
      resolvedIngredientName = created.rows[0].name;
    }

    const updateFragments = [
      'quantity = $3',
      'unit = $4',
      'ingredient = $5',
      'updated_at = NOW()',
    ];
    const updateParams = [targetLocation, resolvedIngredientId, Number(quantity), normalizedUnit, resolvedIngredientName];
    let idx = 6;

    if (nextLow !== undefined) {
      updateFragments.push(`low_stock_threshold = $${idx}`);
      updateParams.push(nextLow);
      idx += 1;
    }
    if (nextFull !== undefined) {
      updateFragments.push(`full_stock_target = $${idx}`);
      updateParams.push(nextFull);
      idx += 1;
    }

    let result = await client.query(
      `UPDATE inventory
       SET ${updateFragments.join(', ')}
       WHERE location_id = $1
         AND ingredient_id = $2
       RETURNING id, location_id, ingredient_id, ingredient, quantity, unit,
                 low_stock_threshold, full_stock_target, updated_at`,
      updateParams
    );

    if (!result.rows.length) {
      const insertCols = ['location_id', 'ingredient_id', 'ingredient', 'quantity', 'unit'];
      const insertVals = ['$1', '$2', '$3', '$4', '$5'];
      const insertParamsIns = [targetLocation, resolvedIngredientId, resolvedIngredientName, Number(quantity), normalizedUnit];
      let insIdx = 6;

      if (nextLow !== undefined) {
        insertCols.push('low_stock_threshold');
        insertVals.push(`$${insIdx}`);
        insertParamsIns.push(nextLow);
        insIdx += 1;
      }
      if (nextFull !== undefined) {
        insertCols.push('full_stock_target');
        insertVals.push(`$${insIdx}`);
        insertParamsIns.push(nextFull);
      }

      result = await client.query(
        `INSERT INTO inventory (${insertCols.join(', ')})
         VALUES (${insertVals.join(', ')})
         RETURNING id, location_id, ingredient_id, ingredient, quantity, unit,
                   low_stock_threshold, full_stock_target, updated_at`,
        insertParamsIns
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Upsert inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/inventory/ingredients — ingredient catalog for menu/inventory forms
router.get('/ingredients', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, default_unit
       FROM ingredients
       ORDER BY name`
    );
    res.json({ ingredients: result.rows });
  } catch (err) {
    console.error('Get ingredient catalog error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/ingredients — create ingredient catalog entry
router.post('/ingredients', authorize('manager', 'owner'), async (req, res) => {
  const name = String(req.body.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const defaultParsed = parseAllowedUnit(req.body.default_unit);
  if (!defaultParsed.ok) {
    return res.status(400).json({ error: defaultParsed.error });
  }
  const defaultUnit = defaultParsed.value;

  try {
    const result = await pool.query(
      `INSERT INTO ingredients (name, default_unit)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET default_unit = COALESCE(EXCLUDED.default_unit, ingredients.default_unit)
       RETURNING id, name, default_unit`,
      [name, defaultUnit]
    );
    res.status(201).json({ ingredient: result.rows[0] });
  } catch (err) {
    console.error('Create ingredient error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/inventory/ingredients/:id — remove ingredient if unreferenced
router.delete('/ingredients/:id', authorize('manager', 'owner'), async (req, res) => {
  const ingredientId = Number(req.params.id);
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }

  try {
    const inMenuUse = await pool.query(
      'SELECT 1 FROM menu_item_ingredients WHERE ingredient_id = $1 LIMIT 1',
      [ingredientId]
    );
    if (inMenuUse.rows.length) {
      return res.status(409).json({ error: 'Cannot delete ingredient used by menu items' });
    }

    const inInventoryUse = await pool.query(
      'SELECT 1 FROM inventory WHERE ingredient_id = $1 LIMIT 1',
      [ingredientId]
    );
    if (inInventoryUse.rows.length) {
      return res.status(409).json({ error: 'Cannot delete ingredient with active inventory records' });
    }

    const result = await pool.query(
      'DELETE FROM ingredients WHERE id = $1 RETURNING id, name',
      [ingredientId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Ingredient not found' });
    }

    res.json({ message: 'Ingredient removed' });
  } catch (err) {
    console.error('Delete ingredient catalog item error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/inventory/:id — partial update (quantity / unit / thresholds)
router.patch('/:id', authorize('manager', 'owner'), async (req, res) => {
  const rowId = Number(req.params.id);
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return res.status(400).json({ error: 'Invalid inventory id' });
  }

  const lowParsed = parseOptionalNonNegativeThreshold(req.body, 'low_stock_threshold');
  if (lowParsed && lowParsed.error) {
    return res.status(400).json({ error: lowParsed.error });
  }
  const fullParsed = parseOptionalNonNegativeThreshold(req.body, 'full_stock_target');
  if (fullParsed && fullParsed.error) {
    return res.status(400).json({ error: fullParsed.error });
  }

  const quantityProvided = Object.prototype.hasOwnProperty.call(req.body, 'quantity');
  let nextQty = undefined;
  if (quantityProvided) {
    const q = Number(req.body.quantity);
    if (!Number.isFinite(q) || q < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative number' });
    }
    nextQty = q;
  }

  const unitProvided = Object.prototype.hasOwnProperty.call(req.body, 'unit');
  let nextUnit = undefined;
  if (unitProvided) {
    const uParsed = parseAllowedUnit(req.body.unit);
    if (!uParsed.ok) {
      return res.status(400).json({ error: uParsed.error });
    }
    nextUnit = uParsed.value;
  }

  const nextLow = lowParsed === undefined ? undefined : lowParsed.value;
  const nextFull = fullParsed === undefined ? undefined : fullParsed.value;

  if (!quantityProvided && nextLow === undefined && nextFull === undefined && nextUnit === undefined) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const existing = await pool.query(
      `SELECT id, location_id, quantity, low_stock_threshold, full_stock_target
       FROM inventory WHERE id = $1`,
      [rowId]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const row = existing.rows[0];
    if (req.user.role !== 'owner' && Number(row.location_id) !== Number(req.user.location_id)) {
      return res.status(403).json({ error: 'Access denied for this inventory item' });
    }

    const effectiveLow = nextLow !== undefined ? nextLow : row.low_stock_threshold;
    const effectiveFull = nextFull !== undefined ? nextFull : row.full_stock_target;
    const pairErr = validateThresholdPair(effectiveLow, effectiveFull);
    if (pairErr) {
      return res.status(400).json({ error: pairErr });
    }

    const updates = [];
    const params = [];
    if (quantityProvided) {
      params.push(nextQty);
      updates.push(`quantity = $${params.length}`);
    }
    if (nextLow !== undefined) {
      params.push(nextLow);
      updates.push(`low_stock_threshold = $${params.length}`);
    }
    if (nextFull !== undefined) {
      params.push(nextFull);
      updates.push(`full_stock_target = $${params.length}`);
    }
    if (nextUnit !== undefined) {
      params.push(nextUnit);
      updates.push(`unit = $${params.length}`);
    }
    updates.push('updated_at = NOW()');
    params.push(rowId);

    const result = await pool.query(
      `UPDATE inventory SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, location_id, ingredient_id, ingredient, quantity, unit,
                 low_stock_threshold, full_stock_target, updated_at`,
      params
    );

    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Patch inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/inventory/:id  — manager / owner only
router.delete('/:id', authorize('manager', 'owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    res.json({ message: 'Item removed' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
