import { Hono } from 'hono'

type Env = { Bindings: { DB: D1Database } }
const app = new Hono<Env>().basePath('/api')

app.notFound((c) => c.json({ error: 'Route not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

const toBooking = (r: any) => ({
  id: r.id, equipmentId: r.equipment_id, borrowerName: r.borrower_name,
  startAt: r.start_at, endAt: r.end_at, purpose: r.purpose, createdAt: r.created_at,
})

const iso = (x: unknown) => {
  if (typeof x !== 'string') return null
  const d = new Date(x)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

async function readBody(c: any) {
  try {
    const b = await c.req.json()
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null
  } catch { return null }
}

// Validates a FULL booking object (used on POST and on merged PATCH)
function validate(b: any) {
  if (typeof b.equipmentId !== 'string' || !b.equipmentId.trim()) return { error: 'equipmentId is required' }
  if (typeof b.borrowerName !== 'string' || !b.borrowerName.trim()) return { error: 'borrowerName is required' }
  const startAt = iso(b.startAt), endAt = iso(b.endAt)
  if (!startAt) return { error: 'startAt must be a valid ISO-8601 date' }
  if (!endAt) return { error: 'endAt must be a valid ISO-8601 date' }
  if (startAt >= endAt) return { error: 'startAt must be before endAt' }
  if (b.purpose != null && typeof b.purpose !== 'string') return { error: 'purpose must be a string' }
  return { v: { equipmentId: b.equipmentId.trim(), borrowerName: b.borrowerName.trim(), startAt, endAt, purpose: b.purpose ?? null } }
}

const overlap = (db: D1Database, eq: string, start: string, end: string, excludeId: string) =>
  db.prepare('SELECT id FROM bookings WHERE equipment_id=?1 AND start_at<?2 AND end_at>?3 AND id!=?4 LIMIT 1')
    .bind(eq, end, start, excludeId).first()

const equipmentExists = (db: D1Database, id: string) =>
  db.prepare('SELECT id FROM equipment WHERE id=?').bind(id).first()

app.get('/equipment', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, location FROM equipment').all()
  return c.json(results)
})

app.get('/bookings', async (c) => {
  const eq = c.req.query('equipmentId')
  const stmt = eq
    ? c.env.DB.prepare('SELECT * FROM bookings WHERE equipment_id=? ORDER BY start_at').bind(eq)
    : c.env.DB.prepare('SELECT * FROM bookings ORDER BY start_at')
  const { results } = await stmt.all()
  return c.json(results.map(toBooking))
})

app.get('/bookings/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(c.req.param('id')).first()
  return row ? c.json(toBooking(row)) : c.json({ error: 'Booking not found' }, 404)
})

app.post('/bookings', async (c) => {
  const body = await readBody(c)
  if (!body) return c.json({ error: 'Body must be a valid JSON object' }, 400)
  const { error, v } = validate(body)
  if (!v) return c.json({ error }, 400)
  if (!(await equipmentExists(c.env.DB, v.equipmentId)))
    return c.json({ error: `Equipment '${v.equipmentId}' not found` }, 404)
  if (await overlap(c.env.DB, v.equipmentId, v.startAt, v.endAt, ''))
    return c.json({ error: 'Equipment is already booked in that time range' }, 409)
  const id = 'bk-' + crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose) VALUES (?,?,?,?,?,?)'
  ).bind(id, v.equipmentId, v.borrowerName, v.startAt, v.endAt, v.purpose).run()
  const row = await c.env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first()
  return c.json(toBooking(row), 201)
})

app.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id')
  const cur: any = await c.env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first()
  if (!cur) return c.json({ error: 'Booking not found' }, 404)
  const body = await readBody(c)
  if (!body) return c.json({ error: 'Body must be a valid JSON object' }, 400)
  const fields = ['equipmentId', 'borrowerName', 'startAt', 'endAt', 'purpose']
  if (!fields.some((f) => f in body)) return c.json({ error: 'No updatable fields provided' }, 400)
  const merged = {
    equipmentId: body.equipmentId ?? cur.equipment_id,
    borrowerName: body.borrowerName ?? cur.borrower_name,
    startAt: body.startAt ?? cur.start_at,
    endAt: body.endAt ?? cur.end_at,
    purpose: 'purpose' in body ? body.purpose : cur.purpose,
  }
  const { error, v } = validate(merged)      // validate the MERGED result
  if (!v) return c.json({ error }, 400)
  if (!(await equipmentExists(c.env.DB, v.equipmentId)))
    return c.json({ error: `Equipment '${v.equipmentId}' not found` }, 404)
  if (await overlap(c.env.DB, v.equipmentId, v.startAt, v.endAt, id))   // exclude self
    return c.json({ error: 'Equipment is already booked in that time range' }, 409)
  await c.env.DB.prepare(
    'UPDATE bookings SET equipment_id=?, borrower_name=?, start_at=?, end_at=?, purpose=? WHERE id=?'
  ).bind(v.equipmentId, v.borrowerName, v.startAt, v.endAt, v.purpose, id).run()
  const row = await c.env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first()
  return c.json(toBooking(row))
})

app.delete('/bookings/:id', async (c) => {
  const id = c.req.param('id')
  const r = await c.env.DB.prepare('DELETE FROM bookings WHERE id=?').bind(id).run()
  if (!r.meta.changes) return c.json({ error: 'Booking not found' }, 404)
  return c.body(null, 204)
})

export default app