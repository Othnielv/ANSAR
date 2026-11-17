import { supplierAccountsApi, type SupplierAccountEntryPayload } from '@/lib/api';

export type SupplierAccountEntryType = 'depot' | 'retrait' | 'emprunt' | 'remboursement';

export interface SupplierAccountEntry {
  id: string;
  fournisseurId: string;
  type: SupplierAccountEntryType;
  montant: number;
  date: string;
  description: string;
  reference?: string;
  supplierLoadingId?: string;
  utilisateur?: string;
}

function parseNum(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
}

function normalize(r: Record<string, unknown>): SupplierAccountEntry {
  return {
    id: String(r.id),
    fournisseurId: String(r.fournisseurId),
    type: r.type as SupplierAccountEntryType,
    montant: parseNum(r.montant),
    date: String(r.date).split('T')[0],
    description: String(r.description),
    reference: r.reference ? String(r.reference) : undefined,
    supplierLoadingId: r.supplierLoadingId ? String(r.supplierLoadingId) : undefined,
    utilisateur: r.utilisateur ? String(r.utilisateur) : undefined,
  };
}

const STORAGE_KEY = 'supplier_account_entries';

function isRemote(): boolean {
  return Boolean(import.meta.env.VITE_API_URL?.trim());
}

let _cache: SupplierAccountEntry[] = [];

function loadFromStorage(): SupplierAccountEntry[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: SupplierAccountEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function refreshSupplierAccountsFromApi(): Promise<void> {
  if (!isRemote()) return;
  const rows = await supplierAccountsApi.getAll();
  _cache = Array.isArray(rows) ? rows.map((r) => normalize(r)) : [];
}

export function getSupplierAccountEntries(): SupplierAccountEntry[] {
  if (isRemote()) return [..._cache];
  return loadFromStorage();
}

function toPayload(e: SupplierAccountEntry): SupplierAccountEntryPayload {
  return {
    id: e.id,
    fournisseurId: e.fournisseurId,
    type: e.type,
    montant: e.montant,
    date: e.date,
    description: e.description,
    reference: e.reference,
    supplierLoadingId: e.supplierLoadingId,
    utilisateur: e.utilisateur,
  };
}

export async function saveSupplierAccountEntryRemote(
  entry: SupplierAccountEntry,
  existingId?: string,
): Promise<void> {
  if (!isRemote()) return;
  if (existingId) {
    await supplierAccountsApi.update(existingId, toPayload(entry));
  } else {
    await supplierAccountsApi.create(toPayload(entry));
  }
  await refreshSupplierAccountsFromApi();
}

export async function deleteSupplierAccountEntryRemote(id: string): Promise<void> {
  if (!isRemote()) return;
  await supplierAccountsApi.delete(id);
  await refreshSupplierAccountsFromApi();
}

export function addSupplierAccountEntryLocal(entry: SupplierAccountEntry): SupplierAccountEntry[] {
  const list = loadFromStorage();
  list.push(entry);
  saveToStorage(list);
  return list;
}

export function updateSupplierAccountEntryLocal(updated: SupplierAccountEntry): SupplierAccountEntry[] {
  const list = loadFromStorage().map((e) => (e.id === updated.id ? updated : e));
  saveToStorage(list);
  return list;
}

export function deleteSupplierAccountEntryLocal(id: string): SupplierAccountEntry[] {
  const list = loadFromStorage().filter((e) => e.id !== id);
  saveToStorage(list);
  return list;
}

export function computeSupplierBalance(
  entries: SupplierAccountEntry[],
  fournisseurId: string,
): number {
  let balance = 0;
  for (const e of entries) {
    if (e.fournisseurId !== fournisseurId) continue;
    if (e.type === 'depot' || e.type === 'remboursement') {
      balance += e.montant;
    } else {
      balance -= e.montant;
    }
  }
  return balance;
}

export function computeAllSupplierBalances(
  entries: SupplierAccountEntry[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const cur = map.get(e.fournisseurId) ?? 0;
    if (e.type === 'depot' || e.type === 'remboursement') {
      map.set(e.fournisseurId, cur + e.montant);
    } else {
      map.set(e.fournisseurId, cur - e.montant);
    }
  }
  return map;
}

export const ENTRY_TYPE_LABELS: Record<SupplierAccountEntryType, string> = {
  depot: 'Dépôt',
  retrait: 'Retrait',
  emprunt: 'Emprunt',
  remboursement: 'Remboursement',
};

export const ENTRY_TYPES: SupplierAccountEntryType[] = [
  'depot',
  'retrait',
  'emprunt',
  'remboursement',
];
