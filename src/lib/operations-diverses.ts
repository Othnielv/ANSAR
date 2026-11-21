/**
 * Opérations Diverses : localStorage (hors ligne / démo) ou API Nest + Supabase.
 * Séparées du brouillard de caisse, ventilées par partie.
 */

import { operationsDiversesApi, type OperationDiversePayload } from '@/lib/api';

export const OD_PARTIES = [
  'Yassa',
  'Afb',
  'CCA',
  'SGC',
  'Top Mobile',
  'Crédit du Sahel',
  'Subaccount',
  'MTN Mobile Money',
  'Orange Money',
  'Sub Account',
  'Spectrum',
  'Top Mobil',
  'MTN Shop',
  'Chèque',
  'Afriland',
  'CBC',
  'UBA',
  'Access Bank',
  'BGFI',
  'Express Exchange',
  'SCB',
] as const;

export type OdPartie = (typeof OD_PARTIES)[number];

export interface OperationDiverse {
  id: string;
  partie: OdPartie;
  type: 'entree' | 'sortie';
  montant: number;
  date: string;
  description: string;
  reference?: string;
  utilisateur?: string;
  modePaiement?: string;
  clientTierId?: string;
  exclutRevenu?: boolean;
}

function isRemoteOd(): boolean {
  return Boolean(import.meta.env.VITE_API_URL?.trim());
}

const STORAGE_KEY = 'operations_diverses';

let _cache: OperationDiverse[] = [];

function parseNum(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

function normalizeOd(r: Record<string, unknown>): OperationDiverse {
  return {
    id: String(r.id),
    partie: String(r.partie) as OdPartie,
    type: r.type as 'entree' | 'sortie',
    montant: parseNum(r.montant),
    date: String(r.date).split('T')[0],
    description: String(r.description),
    reference: r.reference ? String(r.reference) : undefined,
    utilisateur: r.utilisateur ? String(r.utilisateur) : undefined,
    modePaiement: r.modePaiement ? String(r.modePaiement) : undefined,
    clientTierId: r.clientTierId ? String(r.clientTierId) : undefined,
    exclutRevenu: r.exclutRevenu === true,
  };
}

function loadFromStorage(): OperationDiverse[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveToStorage(ops: OperationDiverse[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

export async function refreshOdFromApi(): Promise<void> {
  if (!isRemoteOd()) return;
  const rows = await operationsDiversesApi.getAll();
  _cache = Array.isArray(rows) ? rows.map((r) => normalizeOd(r)) : [];
}

export function getOperationsDiverses(): OperationDiverse[] {
  if (isRemoteOd()) return [..._cache];
  return loadFromStorage();
}

export function setOperationsDiverses(ops: OperationDiverse[]): void {
  if (isRemoteOd()) return;
  saveToStorage(ops);
}

function toPayload(op: OperationDiverse): OperationDiversePayload {
  return {
    id: op.id,
    partie: op.partie,
    type: op.type,
    montant: op.montant,
    date: op.date,
    description: op.description,
    reference: op.reference,
    utilisateur: op.utilisateur,
    modePaiement: op.modePaiement,
    clientTierId: op.clientTierId,
    exclutRevenu: op.exclutRevenu,
  };
}

export async function saveOperationDiverseRemote(
  op: OperationDiverse,
  existingId?: string,
): Promise<void> {
  if (!isRemoteOd()) return;
  if (existingId) {
    await operationsDiversesApi.update(existingId, toPayload(op));
  } else {
    await operationsDiversesApi.create(toPayload(op));
  }
  await refreshOdFromApi();
}

export async function deleteOperationDiverseRemote(id: string): Promise<void> {
  if (!isRemoteOd()) return;
  await operationsDiversesApi.delete(id);
  await refreshOdFromApi();
}

export function addOperationDiverseLocal(op: OperationDiverse): OperationDiverse[] {
  const ops = loadFromStorage();
  ops.push(op);
  saveToStorage(ops);
  return ops;
}

export function updateOperationDiverseLocal(updated: OperationDiverse): OperationDiverse[] {
  const ops = loadFromStorage().map((o) => (o.id === updated.id ? updated : o));
  saveToStorage(ops);
  return ops;
}

export function deleteOperationDiverseLocal(id: string): OperationDiverse[] {
  const ops = loadFromStorage().filter((o) => o.id !== id);
  saveToStorage(ops);
  return ops;
}

export function computeOdSoldeByPartie(ops: OperationDiverse[]): Record<OdPartie, number> {
  const soldes = {} as Record<OdPartie, number>;
  for (const p of OD_PARTIES) soldes[p] = 0;
  for (const op of ops) {
    soldes[op.partie] += op.type === 'entree' ? op.montant : -op.montant;
  }
  return soldes;
}

export function computeOdTotalSolde(ops: OperationDiverse[]): number {
  let total = 0;
  for (const op of ops) {
    total += op.type === 'entree' ? op.montant : -op.montant;
  }
  return total;
}
