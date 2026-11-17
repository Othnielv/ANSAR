'use strict';

const { HttpError, dateOnly, num, audit, rowToJson, randomUUID, query } = require('../lib.cjs');

const TABLE = 'supplier_account_entries';
const MODULE = 'supplier-accounts';

const VALID_TYPES = ['depot', 'retrait', 'emprunt', 'remboursement'];

let _schemaOk = false;
async function ensureSchema() {
  if (_schemaOk) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id UUID PRIMARY KEY,
      "fournisseurId" UUID NOT NULL,
      type VARCHAR(30) NOT NULL CHECK (type IN ('depot', 'retrait', 'emprunt', 'remboursement')),
      montant DECIMAL(15,2) NOT NULL,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      reference VARCHAR(255),
      "supplierLoadingId" UUID,
      utilisateur VARCHAR(120),
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_sae_fournisseur ON ${TABLE} ("fournisseurId")`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sae_date ON ${TABLE} (date)`);
  _schemaOk = true;
}

function mapRow(row) {
  if (!row) return null;
  const j = rowToJson(row);
  j.montant = num(j.montant);
  return j;
}

async function listEntries(fournisseurId) {
  await ensureSchema();
  if (fournisseurId) {
    const { rows } = await query(
      `SELECT * FROM ${TABLE} WHERE "fournisseurId" = $1 ORDER BY date DESC, "createdAt" DESC`,
      [fournisseurId],
    );
    return rows.map(mapRow);
  }
  const { rows } = await query(
    `SELECT * FROM ${TABLE} ORDER BY date DESC, "createdAt" DESC`,
  );
  return rows.map(mapRow);
}

async function getEntry(id) {
  const { rows } = await query(`SELECT * FROM ${TABLE} WHERE id = $1`, [id]);
  return mapRow(rows[0]);
}

function validate(body, partial) {
  if (!partial || body.fournisseurId !== undefined) {
    if (!body.fournisseurId?.trim()) throw HttpError(400, 'Fournisseur requis.');
  }
  if (!partial || body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) throw HttpError(400, 'Type invalide.');
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

async function createEntry(body, actor) {
  await ensureSchema();
  validate(body, false);
  const id = randomUUID();
  const params = [
    id,
    body.fournisseurId.trim(),
    body.type,
    num(body.montant),
    dateOnly(body.date),
    body.description.trim(),
    body.reference?.trim() || null,
    body.supplierLoadingId || null,
    body.utilisateur?.trim() || actor?.login || 'Système',
    new Date(),
  ];
  await query(
    `INSERT INTO ${TABLE}
       (id, "fournisseurId", type, montant, date, description, reference, "supplierLoadingId", utilisateur, "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    params,
  );
  const row = await getEntry(id);
  await audit(MODULE, 'CREATE', id, `${body.type} ${body.montant} FCFA`, null, row, actor);
  return row;
}

async function updateEntry(id, body, actor) {
  await ensureSchema();
  const before = await getEntry(id);
  if (!before) throw HttpError(404, 'Mouvement introuvable');
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
  maybe('fournisseurId', 'fournisseurId', (v) => v.trim());
  maybe('type', 'type');
  maybe('montant', 'montant', num);
  maybe('date', 'date', dateOnly);
  maybe('description', 'description', (v) => v.trim());
  maybe('reference', 'reference', (v) => v?.trim() || null);
  maybe('supplierLoadingId', 'supplierLoadingId', (v) => v || null);
  maybe('utilisateur', 'utilisateur', (v) => v?.trim() || null);

  if (sets.length) {
    await query(`UPDATE ${TABLE} SET ${sets.join(', ')} WHERE id = $1`, vals);
  }
  const after = await getEntry(id);
  await audit(MODULE, 'UPDATE', id, `Modification mouvement`, before, after, actor);
  return after;
}

async function deleteEntry(id, actor) {
  await ensureSchema();
  const before = await getEntry(id);
  if (!before) throw HttpError(404, 'Mouvement introuvable');
  await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
  await audit(MODULE, 'DELETE', id, `Suppression ${before.type} ${before.montant} FCFA`, before, null, actor);
}

module.exports = { listEntries, getEntry, createEntry, updateEntry, deleteEntry };
