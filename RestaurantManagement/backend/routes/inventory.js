const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { parseAllowedUnit } = require('../constants/units');
const { db, nextSequence } = require('../config/db');
const { listCollection, getById, byNameAsc } = require('../utils/firestoreStore');

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
  if (low != null && full != null && Number(low) > Number(full)) {
    return 'low_stock_threshold cannot exceed full_stock_target';
  }
  return null;
}

async function ingredientNameByIdMap() {
  const ingredients = await listCollection('ingredients');
  return new Map(ingredients.map((ing) => [Number(ing.id), ing]));
}

function attachInventoryLocationName(inventory, locations, ingredientMap) {
  const locationName = new Map(locations.map((l) => [Number(l.id), l.name]));
  return inventory.map((item) => {
    const ingredient = ingredientMap.get(Number(item.ingredient_id));
    return {
      ...item,
      ingredient: ingredient?.name || item.ingredient || null,
      unit: item.unit || ingredient?.default_unit || null,
      location_name: locationName.get(Number(item.location_id)) || null,
    };
  });
}

// GET /api/inventory
router.get('/', async (req, res) => {
  try {
    let inventory = await listCollection('inventory');
    const locations = await listCollection('locations');
    const ingredientMap = await ingredientNameByIdMap();

    if (req.user.role !== 'owner') {
      inventory = inventory.filter((item) => Number(item.location_id) === Number(req.user.location_id));
    }

    const rows = attachInventoryLocationName(inventory, locations, ingredientMap).sort((a, b) =>
      String(a.location_name || '')
        .localeCompare(String(b.location_name || '')) ||
      String(a.ingredient || '').localeCompare(String(b.ingredient || ''))
    );

    return res.json({ inventory: rows });
  } catch (err) {
    console.error('Get inventory error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory
router.post('/', authorize('manager', 'owner'), async (req, res) => {
  const { ingredient, quantity, unit, location_id } = req.body;
  const ingredientId = req.body.ingredient_id == null ? null : Number(req.body.ingredient_id);

  const lowParsed = parseOptionalNonNegativeThreshold(req.body, 'low_stock_threshold');
  if (lowParsed && lowParsed.error) return res.status(400).json({ error: lowParsed.error });
  const fullParsed = parseOptionalNonNegativeThreshold(req.body, 'full_stock_target');
  if (fullParsed && fullParsed.error) return res.status(400).json({ error: fullParsed.error });

  const nextLow = lowParsed === undefined ? undefined : lowParsed.value;
  const nextFull = fullParsed === undefined ? undefined : fullParsed.value;
  const pairErr = validateThresholdPair(nextLow, nextFull);
  if (pairErr) return res.status(400).json({ error: pairErr });

  const targetLocation =
    req.user.role === 'owner' && location_id != null ? Number(location_id) : Number(req.user.location_id);

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
  if (!unitParsed.ok) return res.status(400).json({ error: unitParsed.error });
  const normalizedUnit = unitParsed.value;

  try {
    const location = await getById('locations', targetLocation);
    if (!location) {
      return res.status(400).json({ error: 'Invalid location_id' });
    }

    let resolvedIngredientId = ingredientId;
    let resolvedIngredientName = null;

    if (resolvedIngredientId) {
      const existingIngredient = await getById('ingredients', resolvedIngredientId);
      if (!existingIngredient) {
        return res.status(400).json({ error: 'Invalid ingredient_id' });
      }
      resolvedIngredientName = existingIngredient.name;
    } else {
      const rawName = String(ingredient || '').trim();
      const allIngredients = await listCollection('ingredients');
      const existing = allIngredients.find((entry) => String(entry.name || '').toLowerCase() === rawName.toLowerCase());
      if (existing) {
        resolvedIngredientId = Number(existing.id);
        resolvedIngredientName = existing.name;
        if (normalizedUnit && !existing.default_unit) {
          await db.collection('ingredients').doc(String(existing.id)).set({ default_unit: normalizedUnit }, { merge: true });
        }
      } else {
        resolvedIngredientId = await nextSequence('ingredients');
        resolvedIngredientName = rawName;
        await db.collection('ingredients').doc(String(resolvedIngredientId)).set({
          id: resolvedIngredientId,
          name: rawName,
          default_unit: normalizedUnit || null,
          created_at: new Date().toISOString(),
        });
      }
    }

    const inventory = await listCollection('inventory');
    const existingInventory = inventory.find(
      (row) =>
        Number(row.location_id) === Number(targetLocation) &&
        Number(row.ingredient_id) === Number(resolvedIngredientId)
    );

    const payload = {
      location_id: targetLocation,
      ingredient_id: resolvedIngredientId,
      ingredient: resolvedIngredientName,
      quantity: Number(quantity),
      unit: normalizedUnit,
      updated_at: new Date().toISOString(),
    };

    if (nextLow !== undefined) payload.low_stock_threshold = nextLow;
    if (nextFull !== undefined) payload.full_stock_target = nextFull;

    let id = null;
    if (existingInventory) {
      id = Number(existingInventory.id);
      await db.collection('inventory').doc(String(id)).set(payload, { merge: true });
    } else {
      id = await nextSequence('inventory');
      await db.collection('inventory').doc(String(id)).set({ id, ...payload });
    }

    const item = (await getById('inventory', id));
    return res.status(201).json({ item });
  } catch (err) {
    console.error('Upsert inventory error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/ingredients
router.get('/ingredients', async (_req, res) => {
  try {
    const ingredients = (await listCollection('ingredients')).sort(byNameAsc);
    return res.json({ ingredients });
  } catch (err) {
    console.error('Get ingredient catalog error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/ingredients
router.post('/ingredients', authorize('manager', 'owner'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const defaultParsed = parseAllowedUnit(req.body.default_unit);
  if (!defaultParsed.ok) return res.status(400).json({ error: defaultParsed.error });
  const defaultUnit = defaultParsed.value;

  try {
    const allIngredients = await listCollection('ingredients');
    const existing = allIngredients.find((entry) => String(entry.name || '').toLowerCase() === name.toLowerCase());
    if (existing) {
      const updated = {
        ...existing,
        default_unit: existing.default_unit || defaultUnit || null,
      };
      await db.collection('ingredients').doc(String(existing.id)).set(updated, { merge: true });
      return res.status(201).json({ ingredient: updated });
    }

    const id = await nextSequence('ingredients');
    const ingredient = {
      id,
      name,
      default_unit: defaultUnit || null,
      created_at: new Date().toISOString(),
    };
    await db.collection('ingredients').doc(String(id)).set(ingredient);
    return res.status(201).json({ ingredient });
  } catch (err) {
    console.error('Create ingredient error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/inventory/ingredients/:id
router.delete('/ingredients/:id', authorize('manager', 'owner'), async (req, res) => {
  const ingredientId = Number(req.params.id);
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
    return res.status(400).json({ error: 'Invalid ingredient id' });
  }

  try {
    const [menuIngredients, inventory] = await Promise.all([
      listCollection('menu_item_ingredients'),
      listCollection('inventory'),
    ]);

    if (menuIngredients.some((row) => Number(row.ingredient_id) === ingredientId)) {
      return res.status(409).json({ error: 'Cannot delete ingredient used by menu items' });
    }

    if (inventory.some((row) => Number(row.ingredient_id) === ingredientId)) {
      return res.status(409).json({ error: 'Cannot delete ingredient with active inventory records' });
    }

    const ref = db.collection('ingredients').doc(String(ingredientId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Ingredient not found' });

    await ref.delete();
    return res.json({ message: 'Ingredient removed' });
  } catch (err) {
    console.error('Delete ingredient catalog item error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/inventory/:id
router.patch('/:id', authorize('manager', 'owner'), async (req, res) => {
  const rowId = Number(req.params.id);
  if (!Number.isInteger(rowId) || rowId <= 0) {
    return res.status(400).json({ error: 'Invalid inventory id' });
  }

  const lowParsed = parseOptionalNonNegativeThreshold(req.body, 'low_stock_threshold');
  if (lowParsed && lowParsed.error) return res.status(400).json({ error: lowParsed.error });
  const fullParsed = parseOptionalNonNegativeThreshold(req.body, 'full_stock_target');
  if (fullParsed && fullParsed.error) return res.status(400).json({ error: fullParsed.error });

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
    const unitParsed = parseAllowedUnit(req.body.unit);
    if (!unitParsed.ok) return res.status(400).json({ error: unitParsed.error });
    nextUnit = unitParsed.value;
  }

  const nextLow = lowParsed === undefined ? undefined : lowParsed.value;
  const nextFull = fullParsed === undefined ? undefined : fullParsed.value;

  if (!quantityProvided && nextLow === undefined && nextFull === undefined && nextUnit === undefined) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const row = await getById('inventory', rowId);
    if (!row) return res.status(404).json({ error: 'Inventory item not found' });
    if (req.user.role !== 'owner' && Number(row.location_id) !== Number(req.user.location_id)) {
      return res.status(403).json({ error: 'Access denied for this inventory item' });
    }

    const effectiveLow = nextLow !== undefined ? nextLow : row.low_stock_threshold;
    const effectiveFull = nextFull !== undefined ? nextFull : row.full_stock_target;
    const pairErr = validateThresholdPair(effectiveLow, effectiveFull);
    if (pairErr) return res.status(400).json({ error: pairErr });

    const updates = { updated_at: new Date().toISOString() };
    if (quantityProvided) updates.quantity = nextQty;
    if (nextLow !== undefined) updates.low_stock_threshold = nextLow;
    if (nextFull !== undefined) updates.full_stock_target = nextFull;
    if (nextUnit !== undefined) updates.unit = nextUnit;

    await db.collection('inventory').doc(String(rowId)).set(updates, { merge: true });
    const item = await getById('inventory', rowId);
    return res.json({ item });
  } catch (err) {
    console.error('Patch inventory error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', authorize('manager', 'owner'), async (req, res) => {
  try {
    await db.collection('inventory').doc(String(req.params.id)).delete();
    return res.json({ message: 'Item removed' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
