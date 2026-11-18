import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Loader2,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ThirdPartyPicker } from '@/components/ThirdPartyPicker';
import {
  type SupplierAccountEntry,
  type SupplierAccountEntryType,
  ENTRY_TYPES,
  ENTRY_TYPE_LABELS,
  getSupplierAccountEntries,
  refreshSupplierAccountsFromApi,
  saveSupplierAccountEntryRemote,
  deleteSupplierAccountEntryRemote,
  addSupplierAccountEntryLocal,
  updateSupplierAccountEntryLocal,
  deleteSupplierAccountEntryLocal,
  computeAllSupplierBalances,
} from '@/lib/supplier-accounts';

function isRemote(): boolean {
  return Boolean(import.meta.env.VITE_API_URL?.trim());
}

function formatFcfa(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function SoldesFournisseurs() {
  const { canManageTreasury, user } = useAuth();
  const { thirdParties } = useApp();
  const [entries, setEntries] = useState<SupplierAccountEntry[]>([]);
  const [activeFournisseur, setActiveFournisseur] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SupplierAccountEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isSubmitting, withGuard } = useSubmitGuard();

  const [formData, setFormData] = useState({
    fournisseurId: '',
    type: 'depot' as SupplierAccountEntryType,
    montant: 0,
    date: todayIso(),
    description: '',
    reference: '',
  });

  const fournisseurs = useMemo(
    () =>
      thirdParties
        .filter((tp) => tp.type === 'fournisseur' && tp.nom.trim())
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [thirdParties],
  );

  const fournisseursById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fournisseurs) m.set(f.id, f.nom);
    return m;
  }, [fournisseurs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isRemote()) await refreshSupplierAccountsFromApi();
        if (!cancelled) setEntries(getSupplierAccountEntries());
      } catch (e) {
        console.error(e);
        toast.error('Impossible de charger les soldes fournisseurs.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const balances = useMemo(() => computeAllSupplierBalances(entries), [entries]);

  const fournisseursWithBalance = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) ids.add(e.fournisseurId);
    for (const f of fournisseurs) ids.add(f.id);
    return Array.from(ids)
      .map((id) => ({
        id,
        nom: fournisseursById.get(id) || id,
        balance: balances.get(id) ?? 0,
        nbMouvements: entries.filter((e) => e.fournisseurId === id).length,
      }))
      .filter((f) => f.nbMouvements > 0 || f.balance !== 0)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [entries, fournisseurs, fournisseursById, balances]);

  const totalBalance = useMemo(() => {
    let t = 0;
    for (const [, v] of balances) t += v;
    return t;
  }, [balances]);

  const totalEmprunts = useMemo(() => {
    let t = 0;
    for (const [, v] of balances) if (v < 0) t += v;
    return t;
  }, [balances]);

  const totalDepots = useMemo(() => {
    let t = 0;
    for (const [, v] of balances) if (v > 0) t += v;
    return t;
  }, [balances]);

  const filtered = useMemo(() => {
    let list = entries;
    if (activeFournisseur !== 'all') {
      list = list.filter((e) => e.fournisseurId === activeFournisseur);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.reference && e.reference.toLowerCase().includes(q)) ||
          (fournisseursById.get(e.fournisseurId) || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [entries, activeFournisseur, searchTerm, fournisseursById]);

  const resetForm = () => {
    setFormData({
      fournisseurId: activeFournisseur !== 'all' ? activeFournisseur : '',
      type: 'depot',
      montant: 0,
      date: todayIso(),
      description: '',
      reference: '',
    });
    setEditingEntry(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (entry: SupplierAccountEntry) => {
    setEditingEntry(entry);
    setFormData({
      fournisseurId: entry.fournisseurId,
      type: entry.type,
      montant: entry.montant,
      date: entry.date,
      description: entry.description,
      reference: entry.reference || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = () =>
    withGuard(async () => {
      if (!formData.fournisseurId) {
        toast.error('Choisissez un fournisseur.');
        return;
      }
      if (formData.montant <= 0) {
        toast.error('Le montant doit être supérieur à 0.');
        return;
      }
      if (!formData.description.trim()) {
        toast.error('Description requise.');
        return;
      }

      const entry: SupplierAccountEntry = {
        id: editingEntry?.id || crypto.randomUUID(),
        fournisseurId: formData.fournisseurId,
        type: formData.type,
        montant: formData.montant,
        date: formData.date,
        description: formData.description.trim(),
        reference: formData.reference.trim() || undefined,
        utilisateur: user?.login || 'Système',
      };

      if (isRemote()) {
        await saveSupplierAccountEntryRemote(entry, editingEntry?.id);
      } else if (editingEntry) {
        updateSupplierAccountEntryLocal(entry);
      } else {
        addSupplierAccountEntryLocal(entry);
      }

      setEntries(getSupplierAccountEntries());
      setIsDialogOpen(false);
      toast.success(editingEntry ? 'Mouvement mis à jour.' : 'Mouvement enregistré.');
    });

  const handleDelete = (entry: SupplierAccountEntry) =>
    withGuard(async () => {
      if (!confirm(`Supprimer ce mouvement de ${formatFcfa(entry.montant)} ?`)) return;
      if (isRemote()) {
        await deleteSupplierAccountEntryRemote(entry.id);
      } else {
        deleteSupplierAccountEntryLocal(entry.id);
      }
      setEntries(getSupplierAccountEntries());
      toast.success('Mouvement supprimé.');
    });

  const typeBadge = (type: SupplierAccountEntryType) => {
    const cls: Record<SupplierAccountEntryType, string> = {
      depot: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
      retrait: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
      emprunt: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
      remboursement: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    };
    return (
      <Badge variant="outline" className={cls[type]}>
        {ENTRY_TYPE_LABELS[type]}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Soldes Fournisseurs"
        subtitle="Suivi du solde chez chaque fournisseur — dépôts, retraits et emprunts"
        action={
          canManageTreasury && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouveau mouvement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingEntry ? 'Modifier le mouvement' : 'Nouveau mouvement'}
                  </DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Fournisseur *</Label>
                    <ThirdPartyPicker
                      parties={fournisseurs}
                      value={formData.fournisseurId}
                      onChange={(id) => setFormData((f) => ({ ...f, fournisseurId: id }))}
                      placeholder="Choisir un fournisseur"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) =>
                        setFormData((f) => ({ ...f, type: v as SupplierAccountEntryType }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTRY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ENTRY_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Montant (FCFA) *</Label>
                    <NumberInput
                      value={formData.montant || undefined}
                      onValueChange={(v) => setFormData((f) => ({ ...f, montant: v ?? 0 }))}
                      min={0}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Ex: Dépôt client Kamga — bon 3M"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Référence</Label>
                    <Input
                      value={formData.reference}
                      onChange={(e) => setFormData((f) => ({ ...f, reference: e.target.value }))}
                      placeholder="N° bon, reçu, etc."
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total dépôts (soldes positifs)</p>
                <p className="text-xl font-bold text-green-600">{formatFcfa(totalDepots)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total emprunts (soldes négatifs)</p>
                <p className="text-xl font-bold text-orange-600">{formatFcfa(totalEmprunts)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde net global</p>
                <p
                  className={`text-xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatFcfa(totalBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier balance cards grid */}
      {fournisseursWithBalance.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {fournisseursWithBalance.map((f) => (
            <Card
              key={f.id}
              className={`cursor-pointer transition-all hover:shadow-md ${activeFournisseur === f.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() =>
                setActiveFournisseur((prev) => (prev === f.id ? 'all' : f.id))
              }
            >
              <CardContent className="p-4 text-center">
                <p className="text-sm font-medium truncate">{f.nom}</p>
                <p
                  className={`text-lg font-bold mt-1 ${f.balance > 0 ? 'text-green-600' : f.balance < 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                >
                  {formatFcfa(f.balance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {f.nbMouvements} mouvement{f.nbMouvements > 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter + search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher par description, référence, fournisseur…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {activeFournisseur !== 'all' && (
          <Button variant="outline" onClick={() => setActiveFournisseur('all')}>
            Tous les fournisseurs
          </Button>
        )}
      </div>

      {/* Movement table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Mouvements
            {activeFournisseur !== 'all' &&
              ` — ${fournisseursById.get(activeFournisseur) || activeFournisseur}`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun mouvement trouvé.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Référence</TableHead>
                    {canManageTreasury && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                      <TableCell className="font-medium">
                        {fournisseursById.get(e.fournisseurId) || e.fournisseurId}
                      </TableCell>
                      <TableCell>{typeBadge(e.type)}</TableCell>
                      <TableCell
                        className={`text-right font-mono font-semibold whitespace-nowrap ${
                          e.type === 'depot' || e.type === 'remboursement'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {e.type === 'depot' || e.type === 'remboursement' ? '+' : '−'}
                        {formatFcfa(e.montant)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell className="text-muted-foreground">{e.reference || '—'}</TableCell>
                      {canManageTreasury && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDelete(e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
