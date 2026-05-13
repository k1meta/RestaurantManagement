const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { convertUsageForDeduction } = require('../constants/unitConversion');
const { db } = require('../config/db');
const { listCollection, getById } = require('../utils/firestoreStore');

const router = express.Router();
router.use(authenticate);

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'closed'];
const KITCHEN_UPDATE_ROLES = ['kitchen', 'manager', 'owner'];
const CLOSING_ROLES = ['waiter', 'manager', 'owner'];

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function parseStatusFilter(statusValue) {
  if (!statusValue) return [];
  const parsed = String(statusValue)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parsed.filter((s) => ORDER_STATUSES.includes(s));
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function counterRef(name) {
  return db.collection('counters').doc(name);
}

function counterValue(snapshot) {
  if (!snapshot.exists) return 0;
  const value = Number(snapshot.data().value || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function attachItemsToOrders(orders) {
  if (!orders.length) return orders;

  const [allItems, menuItems] = await Promise.all([
    listCollection('order_items'),
    listCollection('menu_items'),
  ]);
  const menuById = new Map(menuItems.map((item) => [Number(item.id), item]));
  const orderIds = new Set(orders.map((order) => Number(order.id)));
  const filtered = allItems.filter((item) => orderIds.has(Number(item.order_id)));

  const itemsByOrder = new Map();
  for (const row of filtered) {
    const menu = menuById.get(Number(row.menu_item_id));
    if (!itemsByOrder.has(Number(row.order_id))) itemsByOrder.set(Number(row.order_id), []);
    itemsByOrder.get(Number(row.order_id)).push({
      ...row,
      item_name: menu?.name || null,
      category: menu?.category || null,
      unit_price: Number(row.unit_price),
    });
  }

  for (const [key, rows] of itemsByOrder.entries()) {
    rows.sort((a, b) => Number(a.id) - Number(b.id));
    itemsByOrder.set(key, rows);
  }

  return orders.map((order) => {
    const items = itemsByOrder.get(Number(order.id)) || [];
    const total_amount = items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
      0
    );
    return { ...order, items, total_amount };
  });
}

async function loadOrdersWithJoins() {
  const [orders, users, locations] = await Promise.all([
    listCollection('orders'),
    listCollection('users'),
    listCollection('locations'),
  ]);

  const userById = new Map(users.map((u) => [Number(u.id), u]));
  const locationById = new Map(locations.map((l) => [Number(l.id), l]));

  return orders.map((order) => ({
    ...order,
    waiter_name: userById.get(Number(order.waiter_id))?.name || null,
    location_name: locationById.get(Number(order.location_id))?.name || null,
  }));
}

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const statusFilter = parseStatusFilter(req.query.status);
    const includeItems = parseBoolean(req.query.include_items, false);
    const includeClosed = parseBoolean(req.query.include_closed, true);

    let orders = await loadOrdersWithJoins();

    if (req.user.role !== 'owner') {
      orders = orders.filter((order) => Number(order.location_id) === Number(req.user.location_id));
    }

    if (statusFilter.length) {
      const allowed = new Set(statusFilter);
      orders = orders.filter((order) => allowed.has(String(order.status || '').toLowerCase()));
    } else if (!includeClosed) {
      orders = orders.filter((order) => order.status !== 'closed');
    }

    orders.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const output = includeItems ? await attachItemsToOrders(orders) : orders;
    return res.json({ orders: output });
  } catch (err) {
    console.error('Get orders error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await getById('orders', id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (req.user.role !== 'owner' && Number(order.location_id) !== Number(req.user.location_id)) {
      return res.status(403).json({ error: 'Access denied for this order' });
    }

    const [users, locations] = await Promise.all([listCollection('users'), listCollection('locations')]);
    const waiter = users.find((u) => Number(u.id) === Number(order.waiter_id));
    const location = locations.find((l) => Number(l.id) === Number(order.location_id));
    const joined = {
      ...order,
      waiter_name: waiter?.name || null,
      location_name: location?.name || null,
    };

    const orderWithItems = (await attachItemsToOrders([joined]))[0];
    return res.json({
      order: orderWithItems,
      items: orderWithItems.items || [],
    });
  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders
router.post('/', authorize('waiter', 'manager', 'owner'), async (req, res) => {
  const { table_number, notes, items, location_id } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }

  const normalizedByMenuId = new Map();
  for (const item of items) {
    const menu_item_id = Number(item.menu_item_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(menu_item_id) || menu_item_id <= 0) {
      return res.status(400).json({ error: 'Each item needs a valid menu_item_id' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Each item needs a positive integer quantity' });
    }

    const existing = normalizedByMenuId.get(menu_item_id) || 0;
    normalizedByMenuId.set(menu_item_id, existing + quantity);
  }

  const normalizedItems = Array.from(normalizedByMenuId.entries()).map(([menu_item_id, quantity]) => ({
    menu_item_id,
    quantity,
  }));

  const targetLocation =
    req.user.role === 'owner' ? Number(location_id || req.user.location_id) : Number(req.user.location_id);
  if (!Number.isInteger(targetLocation) || targetLocation <= 0) {
    return res.status(400).json({ error: 'A valid location_id is required' });
  }

  try {
    const createdOrderId = await db.runTransaction(async (tx) => {
      const locationRef = db.collection('locations').doc(String(targetLocation));
      const locationSnap = await tx.get(locationRef);
      if (!locationSnap.exists) {
        throw httpError(500, `Location ${targetLocation} does not exist`);
      }

      const menuRefs = normalizedItems.map((item) =>
        db.collection('menu_items').doc(String(item.menu_item_id))
      );
      const menuSnaps = await Promise.all(menuRefs.map((ref) => tx.get(ref)));
      const menuById = new Map();
      for (let idx = 0; idx < normalizedItems.length; idx += 1) {
        const item = normalizedItems[idx];
        const menuSnap = menuSnaps[idx];
        if (!menuSnap.exists || menuSnap.data().active === false) {
          throw httpError(500, `Menu item(s) not found or inactive: ${item.menu_item_id}`);
        }
        menuById.set(item.menu_item_id, menuSnap.data());
      }

      const [orderCounterSnap, orderItemsCounterSnap] = await Promise.all([
        tx.get(counterRef('orders')),
        tx.get(counterRef('order_items')),
      ]);
      const orderId = counterValue(orderCounterSnap) + 1;
      const startingOrderItemId = counterValue(orderItemsCounterSnap);

      const now = new Date().toISOString();
      tx.set(db.collection('orders').doc(String(orderId)), {
        id: orderId,
        location_id: targetLocation,
        waiter_id: req.user.id,
        table_number: table_number ? String(table_number).trim() : null,
        status: 'pending',
        notes: notes || null,
        created_at: now,
        closed_at: null,
      });

      normalizedItems.forEach((item, index) => {
        const itemId = startingOrderItemId + index + 1;
        tx.set(db.collection('order_items').doc(String(itemId)), {
          id: itemId,
          order_id: orderId,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: Number(menuById.get(item.menu_item_id).price),
        });
      });

      tx.set(counterRef('orders'), { value: orderId }, { merge: true });
      tx.set(
        counterRef('order_items'),
        { value: startingOrderItemId + normalizedItems.length },
        { merge: true }
      );

      return orderId;
    });

    const joinedOrder = (await loadOrdersWithJoins()).find((order) => Number(order.id) === Number(createdOrderId));
    const orderWithItems = (await attachItemsToOrders([joinedOrder]))[0];
    return res.status(201).json({ order: orderWithItems });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', async (req, res) => {
  const status = String(req.body.status || '').toLowerCase();
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }

  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  try {
    const updatedOrder = await db.runTransaction(async (tx) => {
      const orderRef = db.collection('orders').doc(String(orderId));
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw httpError(404, 'Order not found');
      }

      const currentOrder = orderSnap.data();
      const previousStatus = currentOrder.status;

      if (req.user.role !== 'owner' && Number(currentOrder.location_id) !== Number(req.user.location_id)) {
        throw httpError(403, 'Access denied for this order');
      }
      if (['preparing', 'ready'].includes(status) && !KITCHEN_UPDATE_ROLES.includes(req.user.role)) {
        throw httpError(403, 'Only kitchen, manager, or owner can set preparing/ready');
      }
      if (status === 'closed' && !CLOSING_ROLES.includes(req.user.role)) {
        throw httpError(403, 'Only waiter, manager, or owner can close orders');
      }
      if (status === 'closed' && req.user.role === 'waiter' && previousStatus !== 'ready') {
        throw httpError(409, 'Waiter can only close orders that are ready');
      }
      if (status === 'pending' && !['manager', 'owner'].includes(req.user.role)) {
        throw httpError(403, 'Only manager or owner can move an order back to pending');
      }

      const updatePayload = { status };
      if (status === 'closed' && !currentOrder.closed_at) {
        updatePayload.closed_at = new Date().toISOString();
      }

      const inventoryUpdates = [];
      const salesRowsToInsert = [];
      let salesCounterNext = null;

      if (status === 'closed' && previousStatus !== 'closed') {
        const orderItemsSnap = await tx.get(
          db.collection('order_items').where('order_id', '==', orderId)
        );
        const orderItems = orderItemsSnap.docs.map((doc) => doc.data());

        const groupedSales = new Map();
        for (const item of orderItems) {
          const current = groupedSales.get(Number(item.menu_item_id)) || {
            quantity: 0,
            total_price: 0,
          };
          current.quantity += Number(item.quantity);
          current.total_price += Number(item.quantity) * Number(item.unit_price);
          groupedSales.set(Number(item.menu_item_id), current);
        }

        const existingSalesSnap = await tx.get(
          db.collection('sales').where('order_id', '==', orderId)
        );
        const existingSalesMenuIds = new Set(
          existingSalesSnap.docs.map((doc) => Number(doc.data().menu_item_id))
        );

        for (const [menuItemId, agg] of groupedSales.entries()) {
          if (existingSalesMenuIds.has(menuItemId)) continue;
          salesRowsToInsert.push({
            location_id: currentOrder.location_id,
            menu_item_id: menuItemId,
            order_id: orderId,
            quantity: agg.quantity,
            total_price: agg.total_price,
          });
        }

        if (salesRowsToInsert.length > 0) {
          const salesCounterSnap = await tx.get(counterRef('sales'));
          salesCounterNext = counterValue(salesCounterSnap);
        }

        const ingredientLinksSnap = await tx.get(db.collection('menu_item_ingredients'));
        const links = ingredientLinksSnap.docs.map((doc) => doc.data());
        const usageByIngredient = new Map();

        for (const item of orderItems) {
          const itemLinks = links.filter((link) => Number(link.menu_item_id) === Number(item.menu_item_id));
          for (const link of itemLinks) {
            const key = Number(link.ingredient_id);
            const current = usageByIngredient.get(key) || {
              ingredient_id: key,
              unit: link.unit || null,
              usage_qty: 0,
            };
            if (current.unit && link.unit && current.unit !== link.unit) {
              throw httpError(
                409,
                `Conflicting recipe units for ingredient_id ${key}; align menu ingredient units.`
              );
            }
            current.unit = current.unit || link.unit || null;
            current.usage_qty += Number(item.quantity) * Number(link.quantity_required);
            usageByIngredient.set(key, current);
          }
        }

        const ingredientsSnap = await tx.get(db.collection('ingredients'));
        const ingredientsById = new Map(
          ingredientsSnap.docs.map((doc) => [Number(doc.data().id), doc.data()])
        );

        const inventoryByLocationSnap = await tx.get(
          db.collection('inventory').where('location_id', '==', Number(currentOrder.location_id))
        );
        const inventoryRows = inventoryByLocationSnap.docs.map((doc) => ({
          ...doc.data(),
          _docRef: doc.ref,
        }));

        for (const usage of usageByIngredient.values()) {
          const invRow = inventoryRows.find((row) => Number(row.ingredient_id) === Number(usage.ingredient_id));
          const ingredient = ingredientsById.get(Number(usage.ingredient_id));

          if (!invRow) {
            throw httpError(
              409,
              `Missing inventory record for ingredient ${ingredient?.name || usage.ingredient_id}`
            );
          }

          const currentQty = Number(invRow.quantity);
          const usageQty = Number(usage.usage_qty);
          const usageUnit = usage.unit || ingredient?.default_unit || null;
          const inventoryUnit = invRow.unit || ingredient?.default_unit || null;

          const deduction = convertUsageForDeduction(
            usageQty,
            usageUnit,
            currentQty,
            inventoryUnit
          );

          if (!deduction.ok) {
            throw httpError(
              409,
              `${deduction.error} Ingredient: ${ingredient?.name || usage.ingredient_id}.`
            );
          }

          inventoryUpdates.push({
            ref: invRow._docRef,
            quantity: deduction.nextQty,
          });
        }
      }

      tx.set(orderRef, updatePayload, { merge: true });

      if (salesRowsToInsert.length > 0) {
        salesRowsToInsert.forEach((saleRow, index) => {
          const saleId = Number(salesCounterNext) + index + 1;
          tx.set(db.collection('sales').doc(String(saleId)), {
            id: saleId,
            ...saleRow,
            sold_at: new Date().toISOString(),
          });
        });
        tx.set(
          counterRef('sales'),
          { value: Number(salesCounterNext) + salesRowsToInsert.length },
          { merge: true }
        );
      }

      inventoryUpdates.forEach((entry) => {
        tx.set(
          entry.ref,
          {
            quantity: entry.quantity,
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      return {
        ...currentOrder,
        ...updatePayload,
      };
    });

    return res.json({ order: updatedOrder });
  } catch (err) {
    console.error('Update order status error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
