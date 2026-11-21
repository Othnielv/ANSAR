'use strict';

const { HttpError, dateOnly, num, audit, rowToJson, randomUUID, query } = require('../lib.cjs');

const TABLE = 'operations_diverses';
const MODULE = 'operations-diverses';

const VALID_PARTIES = [
  'Yassa', 'Afb', 'CCA', 'SGC', 'Top Mobile',
  'Crédit du Sahel', 'Shop', 'Account',
];
const VALID_TYPES = ['entree', 'sortie'];

let _schemaOk = false;
async function ensureSchema() {
  if (_schemaOk) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id VARCHAR(128) PRIMARY KEY,
      partie VARCHAR(60) NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('entree', 'sortie')),
      montant DECIMAL(15,2) NOT NULL,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      reference VARCHAR(255),
      utilisateur VARCHAR(120),
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_od_partie ON ${TABLE} (partie)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_od_date ON ${TABLE} (date)`);
  const cols = [
    { name: 'mode_paiement', def: 'VARCHAR(255)' },
    { name: 'client_tier_id', def: 'VARCHAR(128)' },
    { name: 'exclut_revenu', def: 'BOOLEAN DEFAULT FALSE' },
  ];
  for (const c of cols) {
    await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "${c.name}" ${c.def}`).catch(() => {});
  }
  _schemaOk = true;
}

function mapRow(row) {
  if (!row) return null;
  const j = rowToJson(row);
  j.montant = num(j.montant);
  if (j.mode_paiement !== undefined) { j.modePaiement = j.mode_paiement; delete j.mode_paiement; }
  if (j.client_tier_id !== undefined) { j.clientTierId = j.client_tier_id; delete j.client_tier_id; }
  if (j.exclut_revenu !== undefined) { j.exclutRevenu = j.exclut_revenu === true || j.exclut_revenu === 't'; delete j.exclut_revenu; }
  return j;
}

async function listOperations() {
  await ensureSchema();
  const { rows } = await query(
    `SELECT * FROM ${TABLE} ORDER BY date DESC, "createdAt" DESC`,
  );
  return rows.map(mapRow);
}

async function getOperation(id) {
  await ensureSchema();
  const { rows } = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return mapRow(rows[0]);
}

function validate(body, partial) {
  if (!partial || body.partie !== undefined) {
    if (!VALID_PARTIES.includes(body.partie)) throw HttpError(400, 'Partie invalide.');
  }
  if (!partial || body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) throw HttpError(400, 'Type invalide (entree ou sortie).');
  }
  if (!partial || body.montant !== undefined) {
    if (body.montant == null || num(body.montant) <= 0) throw HttpError(400, 'Montant requis (> 0).');
  }
  if (!partial || body.date !== undefined) {
    if (!body.date?.trim()) throw HttpError(400, 'Date requise.');
  }
  if (!partial || body.description !== undefined) {
    if (!body.description?.trim()) throw HttpError(400, 'Description requise.');
  }
}

async function createOperation(body, actor) {
  await ensureSchema();
  validate(body, false);
  const id = body.id?.trim() || randomUUID();
  const params = [
    id,
    body.partie,
    body.type,
    num(body.montant),
    dateOnly(body.date),
    body.description.trim(),
    body.reference?.trim() || null,
    body.utilisateur?.trim() || actor?.login || 'Système',
    new Date(),
    body.modePaiement?.trim() || null,
    body.clientTierId?.trim() || null,
    body.exclutRevenu === true,
  ];
  await query(
    `INSERT INTO ${TABLE}
       (id, partie, type, montant, date, description, reference, utilisateur, "createdAt", mode_paiement, client_tier_id, exclut_revenu)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    params,
  );
  const row = await getOperation(id);
  await audit(MODULE, 'CREATE', id, `${body.type} ${body.montant} FCFA – ${body.partie}`, null, row, actor);
  return row;
}

async function updateOperation(id, body, actor) {
  await ensureSchema();
  const before = await getOperation(id);
  if (!before) throw HttpError(404, 'Opération diverse introuvable');
  validate(body, true);

  const sets = [];
  const vals = [id];
  let idx = 2;
  const maybe = (col, key, transform) => {
    if (body[key] !== undefined) {
      const v = transform ? transform(body[key]) : body[key];
      sets.push(`"${col}" = $${idx}`);
      vals.push(v);
      idx++;
    }
  };
  maybe('partie', 'partie');
  maybe('type', 'type');
  maybe('montant', 'montant', num);
  maybe('date', 'date', dateOnly);
  maybe('description', 'description', (v) => v.trim());
  maybe('reference', 'reference', (v) => v?.trim() || null);
  maybe('utilisateur', 'utilisateur', (v) => v?.trim() || null);
  maybe('mode_paiement', 'modePaiement', (v) => v?.trim() || null);
  maybe('client_tier_id', 'clientTierId', (v) => v?.trim() || null);
  maybe('exclut_revenu', 'exclutRevenu', (v) => v === true);

  if (sets.length) {
    await query(`UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $1`, vals);
  }
  const after = await getOperation(id);
  await audit(MODULE, 'UPDATE', id, `Modification OD`, before, after, actor);
  return after;
}

async function deleteOperation(id, actor) {
  await ensureSchema();
  const before = await getOperation(id);
  if (!before) throw HttpError(404, 'Opération diverse introuvable');
  await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  await audit(MODULE, 'DELETE', id, `Suppression OD ${before.partie} – ${before.description}`, before, null, actor);
}

module.exports = { listOperations, getOperation, createOperation, updateOperation, deleteOperation };
