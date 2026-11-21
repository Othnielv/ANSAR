import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Search, Shuffle, TrendingUp, TrendingDown, Loader2, Heart, ArrowDownToLine, ArrowUpFromLine, FileDown, FileText } from 'lucide-react';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ThirdPartyPicker } from '@/components/ThirdPartyPicker';
import { PaymentModePicker } from '@/components/PaymentModePicker';
import {
  type OperationDiverse,
  type OdPartie,
  OD_PARTIES,
  getOperationsDiverses,
  refreshOdFromApi,
  saveOperationDiverseRemote,
  deleteOperationDiverseRemote,
  addOperationDiverseLocal,
  updateOperationDiverseLocal,
  deleteOperationDiverseLocal,
  computeOdSoldeByPartie,
  computeOdTotalSolde,
} from '@/lib/operations-diverses';
import {
  type CaisseTransaction,
  saveCaisseTransactionRemote,
  getCaisseTransactions,
  refreshCaisseFromApi,
} from '@/lib/caisse-local';
import { exportToExcel, exportToPrintablePDF, type ExportTotal } from '@/lib/export-utils';

function isRemote(): boolean {
  return Boolean(import.meta.env.VITE_API_URL?.trim());
}

const PARTIE_COLORS: Record<OdPartie, string> = {
  Yassa: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  Afb: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  CCA: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  SGC: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  'Top Mobile': 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30',
  'Crédit du Sahel': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  Subaccount: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  'MTN Mobile Money': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  'Orange Money': 'bg-orange-600/15 text-orange-800 dark:text-orange-300 border-orange-600/30',
  'Sub Account': 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
  Spectrum: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  'Top Mobil': 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  'MTN Shop': 'bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30',
  'Chèque': 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
  Afriland: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  CBC: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  UBA: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  'Access Bank': 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  BGFI: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30',
  'Express Exchange': 'bg-stone-500/15 text-stone-700 dark:text-stone-400 border-stone-500/30',
  SCB: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30',
};

type DialogMode = 'operation' | 'retrait' | 'depot' | 'depense';

export default function OperationsDiverses() {
  const { canManageTreasury, user } = useAuth();
  const { thirdParties } = useApp();
  const [operations, setOperations] = useState<OperationDiverse[]>([]);
  const [activePartie, setActivePartie] = useState<'all' | OdPartie>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('operation');
  const [editingOp, setEditingOp] = useState<OperationDiverse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isSubmitting, withGuard } = useSubmitGuard();

  const clients = useMemo(
    () => thirdParties.filter((tp) => tp.type === 'client'),
    [thirdParties],
  );

  const fournisseurs = useMemo(
    () => thirdParties.filter((tp) => tp.type === 'fournisseur'),
    [thirdParties],
  );

  const [formData, setFormData] = useState({
    partie: 'Yassa' as OdPartie,
    type: 'entree' as 'entree' | 'sortie',
    montant: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    modePaiement: '',
    clientTierId: '',
    exclutRevenu: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isRemote()) await refreshOdFromApi();
        if (!cancelled) setOperations(getOperationsDiverses());
      } catch (e) {
        console.error(e);
        toast.error('Impossible de charger les operations diverses.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const soldesByPartie = useMemo(() => computeOdSoldeByPartie(operations), [operations]);
  const totalSolde = useMemo(() => computeOdTotalSolde(operations), [operations]);

  const filteredOps = useMemo(() => {
    let ops = operations;
    if (activePartie !== 'all') {
      ops = ops.filter((o) => o.partie === activePartie);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      ops = ops.filter(
        (o) =>
          o.description.toLowerCase().includes(q) ||
          (o.reference || '').toLowerCase().includes(q) ||
          o.partie.toLowerCase().includes(q),
      );
    }
    return [...ops].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return db - da || b.id.localeCompare(a.id);
    });
  }, [operations, activePartie, searchTerm]);

  const filteredStats = useMemo(() => {
    const entrees = filteredOps.filter((o) => o.type === 'entree');
    const sorties = filteredOps.filter((o) => o.type === 'sortie');
    return {
      totalEntrees: entrees.reduce((s, o) => s + o.montant, 0),
      totalSorties: sorties.reduce((s, o) => s + o.montant, 0),
    };
  }, [filteredOps]);

  const pdfTotals: ExportTotal[] = useMemo(() => [
    {
      label: 'Solde global OD',
      value: `${totalSolde >= 0 ? '+' : '−'}${Math.abs(totalSolde).toLocaleString('fr-FR')} FCFA`,
      style: totalSolde >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Entrées',
      value: `+${filteredStats.totalEntrees.toLocaleString('fr-FR')} FCFA`,
      style: 'positive',
    },
    {
      label: 'Sorties',
      value: `−${filteredStats.totalSorties.toLocaleString('fr-FR')} FCFA`,
      style: 'negative',
    },
  ], [totalSolde, filteredStats]);

  const handleExportExcel = () => {
    exportToExcel({
      title: `Opérations Diverses${activePartie !== 'all' ? ` — ${activePartie}` : ''}`,
      fileName: `od_${new Date().toISOString().split('T')[0]}.xlsx`,
      columns: [
        { header: 'Date', value: (o) => new Date(o.date).toLocaleDateString('fr-FR') },
        { header: 'Compte', value: (o) => o.partie },
        { header: 'Type', value: (o) => (o.type === 'entree' ? 'Entrée' : 'Sortie') },
        { header: 'Entrée (FCFA)', value: (o) => (o.type === 'entree' ? o.montant : '') },
        { header: 'Sortie (FCFA)', value: (o) => (o.type === 'sortie' ? o.montant : '') },
        { header: 'Description', value: (o) => o.description },
        { header: 'Client', value: (o) => resolveClientName(o.clientTierId) || '—' },
        { header: 'Mode', value: (o) => o.modePaiement || '—' },
        { header: 'Référence', value: (o) => o.reference || '—' },
      ],
      rows: filteredOps,
    });
  };

  const handleExportPDF = () => {
    exportToPrintablePDF({
      title: `Opérations Diverses${activePartie !== 'all' ? ` — ${activePartie}` : ''}`,
      fileName: `od_${new Date().toISOString().split('T')[0]}.pdf`,
      headerColor: '#4f46e5',
      headerTextColor: '#ffffff',
      evenRowColor: '#eef2ff',
      oddRowColor: '#ffffff',
      accentColor: '#4f46e5',
      totals: pdfTotals,
      columns: [
        { header: 'Date', value: (o) => new Date(o.date).toLocaleDateString('fr-FR') },
        { header: 'Compte', value: (o) => o.partie },
        { header: 'Type', value: (o) => (o.type === 'entree' ? 'Entrée' : 'Sortie'), cellStyle: (o) => (o.type === 'entree' ? 'positive' : 'negative') },
        { header: 'Entrée (FCFA)', value: (o) => (o.type === 'entree' ? `+${o.montant.toLocaleString('fr-FR')}` : '—'), cellStyle: (o) => (o.type === 'entree' ? 'positive' : undefined) },
        { header: 'Sortie (FCFA)', value: (o) => (o.type === 'sortie' ? `−${o.montant.toLocaleString('fr-FR')}` : '—'), cellStyle: (o) => (o.type === 'sortie' ? 'negative' : undefined) },
        { header: 'Description', value: (o) => o.description },
        { header: 'Client', value: (o) => resolveClientName(o.clientTierId) || '—' },
        { header: 'Mode', value: (o) => o.modePaiement || '—' },
      ],
      rows: filteredOps,
    });
  };

  const resetForm = () => {
    setFormData({
      partie: activePartie !== 'all' ? activePartie : 'Yassa',
      type: 'entree',
      montant: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      modePaiement: '',
      clientTierId: '',
      exclutRevenu: false,
    });
    setEditingOp(null);
  };

  const openDialog = (mode: DialogMode) => {
    resetForm();
    setDialogMode(mode);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const montant = Number(formData.montant);
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error('Indique un montant valide.');
      return;
    }
    if (dialogMode === 'operation' && !formData.description.trim()) {
      toast.error('Ajoute une description.');
      return;
    }

    withGuard(async () => {
      const utilisateur = user?.login || 'Systeme';
      const today = formData.date;

      if (dialogMode === 'retrait') {
        const desc = formData.description.trim() || `Retrait ${formData.partie} vers caisse`;
        const refId = crypto.randomUUID();

        const odSortie: OperationDiverse = {
          id: crypto.randomUUID(),
          partie: formData.partie,
          type: 'sortie',
          montant,
          date: today,
          description: desc,
          reference: `retrait-caisse:${refId}`,
          utilisateur,
          modePaiement: formData.modePaiement.trim() || undefined,
        };

        const caisseEntree: CaisseTransaction = {
          id: Date.now().toString(),
          type: 'entree',
          montant,
          date: today,
          description: `Retrait OD (${formData.partie})${formData.description.trim() ? ' - ' + formData.description.trim() : ''}`,
          utilisateur,
          modePaiement: 'Espèces',
          reference: `retrait-od:${refId}`,
        };

        if (isRemote()) {
          await saveOperationDiverseRemote(odSortie);
          await saveCaisseTransactionRemote(caisseEntree, true);
          setOperations(getOperationsDiverses());
        } else {
          setOperations(addOperationDiverseLocal(odSortie));
        }
        toast.success(`Retrait de ${montant.toLocaleString('fr-FR')} FCFA vers caisse effectué.`);
        setIsDialogOpen(false);
        resetForm();
        return;
      }

      if (dialogMode === 'depot') {
        const desc = formData.description.trim() || `Dépôt caisse vers ${formData.partie}`;
        const refId = crypto.randomUUID();

        const odEntree: OperationDiverse = {
          id: crypto.randomUUID(),
          partie: formData.partie,
          type: 'entree',
          montant,
          date: today,
          description: desc,
          reference: `depot-caisse:${refId}`,
          utilisateur,
          modePaiement: formData.modePaiement.trim() || undefined,
        };

        const caisseSortie: CaisseTransaction = {
          id: Date.now().toString(),
          type: 'sortie',
          montant,
          date: today,
          description: `Dépôt vers OD (${formData.partie})${formData.description.trim() ? ' - ' + formData.description.trim() : ''}`,
          utilisateur,
          modePaiement: 'Espèces',
          categorie: 'Retrait',
          reference: `depot-od:${refId}`,
        };

        if (isRemote()) {
          await saveOperationDiverseRemote(odEntree);
          await saveCaisseTransactionRemote(caisseSortie, true);
          setOperations(getOperationsDiverses());
        } else {
          setOperations(addOperationDiverseLocal(odEntree));
        }
        toast.success(`Dépôt de ${montant.toLocaleString('fr-FR')} FCFA vers ${formData.partie} effectué.`);
        setIsDialogOpen(false);
        resetForm();
        return;
      }

      if (dialogMode === 'depense') {
        if (!formData.description.trim()) {
          toast.error('Ajoute une description pour la dépense.');
          return;
        }
        const refId = crypto.randomUUID();
        const desc = formData.description.trim();

        const odSortie: OperationDiverse = {
          id: crypto.randomUUID(),
          partie: formData.partie,
          type: 'sortie',
          montant,
          date: today,
          description: `Crédit vers caisse — ${desc}`,
          reference: `depense-caisse:${refId}`,
          utilisateur,
          modePaiement: formData.modePaiement.trim() || undefined,
          clientTierId: formData.clientTierId || undefined,
        };

        const caisseSortie: CaisseTransaction = {
          id: Date.now().toString(),
          type: 'sortie',
          montant,
          date: today,
          description: `[OD ${formData.partie}] ${desc}`,
          utilisateur,
          modePaiement: 'Espèces',
          reference: `depense-od:${refId}`,
          clientTierId: formData.clientTierId || undefined,
        };

        if (isRemote()) {
          await saveOperationDiverseRemote(odSortie);
          await saveCaisseTransactionRemote(caisseSortie, true);
          await refreshCaisseFromApi();
          setOperations(getOperationsDiverses());
        } else {
          setOperations(addOperationDiverseLocal(odSortie));
        }
        toast.success(`Dépense de ${montant.toLocaleString('fr-FR')} FCFA depuis ${formData.partie} enregistrée.`);
        setIsDialogOpen(false);
        resetForm();
        return;
      }

      const base: Omit<OperationDiverse, 'id'> = {
        partie: formData.partie,
        type: 'entree',
        montant,
        date: formData.date,
        description: formData.description.trim(),
        reference: formData.reference.trim() || undefined,
        utilisateur,
        modePaiement: formData.modePaiement.trim() || undefined,
        clientTierId: formData.clientTierId || undefined,
        exclutRevenu: formData.type === 'entree' && formData.exclutRevenu ? true : undefined,
      };

      if (editingOp) {
        const updated: OperationDiverse = { ...editingOp, ...base };
        if (isRemote()) {
          await saveOperationDiverseRemote(updated, editingOp.id);
          setOperations(getOperationsDiverses());
        } else {
          setOperations(updateOperationDiverseLocal(updated));
        }
        toast.success('Operation modifiee.');
      } else {
        const newOp: OperationDiverse = { id: crypto.randomUUID(), ...base };
        if (isRemote()) {
          await saveOperationDiverseRemote(newOp);
          const caisseMirror: CaisseTransaction = {
            id: Date.now().toString(),
            type: newOp.type,
            montant: newOp.montant,
            date: newOp.date,
            description: `[OD ${newOp.partie}] ${newOp.description}`,
            utilisateur: newOp.utilisateur,
            modePaiement: 'Espèces',
            reference: `od-linked:${newOp.id}`,
            clientTierId: newOp.clientTierId,
            exclutRevenu: newOp.exclutRevenu,
          };
          await saveCaisseTransactionRemote(caisseMirror, true);
          await refreshCaisseFromApi();
          setOperations(getOperationsDiverses());
        } else {
          setOperations(addOperationDiverseLocal(newOp));
        }
        toast.success('Operation ajoutee (+ caisse mise à jour).');
      }
      setIsDialogOpen(false);
      resetForm();
    });
  };

  const handleEdit = (op: OperationDiverse) => {
    setEditingOp(op);
    setDialogMode('operation');
    setFormData({
      partie: op.partie,
      type: op.type,
      montant: op.montant,
      date: op.date,
      description: op.description,
      reference: op.reference || '',
      modePaiement: op.modePaiement || '',
      clientTierId: op.clientTierId || '',
      exclutRevenu: op.type === 'entree' && Boolean(op.exclutRevenu),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette operation ?')) return;
    withGuard(async () => {
      if (isRemote()) {
        await deleteOperationDiverseRemote(id);
        setOperations(getOperationsDiverses());
      } else {
        setOperations(deleteOperationDiverseLocal(id));
      }
      toast.success('Operation supprimee.');
    });
  };

  const resolveClientName = (tierId?: string) => {
    if (!tierId) return null;
    return thirdParties.find((tp) => tp.id === tierId)?.nom || null;
  };

  const dialogTitle = dialogMode === 'retrait'
    ? 'Retrait vers caisse'
    : dialogMode === 'depot'
      ? "Dépôt depuis caisse"
      : dialogMode === 'depense'
        ? "Dépense depuis un compte OD"
        : editingOp ? "Modifier l'opération" : "Nouvelle entrée";

  return (
    <div className="space-y-6 p-1">
      <PageHeader
        title="Opérations Diverses"
        icon={Shuffle}
        gradient="from-indigo-500/20 via-purple-500/10 to-transparent"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
              <FileDown className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            {canManageTreasury && (
              <>
<Button variant="outline" size="sm" onClick={() => openDialog('retrait')}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Retrait vers caisse
              </Button>
              <Button variant="outline" size="sm" onClick={() => openDialog('depot')}>
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                D{'é'}p{'ô'}t depuis caisse
              </Button>
              <Button variant="outline" size="sm" onClick={() => openDialog('depense')}>
                <TrendingDown className="mr-2 h-4 w-4" />
                D{'é'}pense depuis compte
              </Button>
              <Button onClick={() => openDialog('operation')}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle entr{'é'}e
              </Button>
              </>
            )}
          </div>
        }
      />

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {dialogMode === 'retrait' && (
              <div className="rounded-lg border border-green-200/80 dark:border-green-900/50 bg-green-50/60 dark:bg-green-950/25 p-3">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <ArrowDownToLine className="inline h-4 w-4 mr-1" />
                  Retire de l&apos;argent d&apos;un compte OD et le transfère en espèces dans la caisse.
                </p>
              </div>
            )}
            {dialogMode === 'depot' && (
              <div className="rounded-lg border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/25 p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <ArrowUpFromLine className="inline h-4 w-4 mr-1" />
                  Dépose des espèces de la caisse vers un compte OD.
                </p>
              </div>
            )}
            {dialogMode === 'depense' && (
              <div className="rounded-lg border border-red-200/80 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/25 p-3">
                <p className="text-sm text-red-800 dark:text-red-300">
                  <TrendingDown className="inline h-4 w-4 mr-1" />
                  Débite le compte OD et enregistre la dépense dans la caisse automatiquement.
                </p>
              </div>
            )}

            {(dialogMode === 'operation' || dialogMode === 'depense') && (
              <div>
                <Label htmlFor="od-montant">Montant (FCFA) *</Label>
                <Input
                  id="od-montant"
                  type="number"
                  value={formData.montant || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })
                  }
                  required
                  min="0"
                />
              </div>
            )}

            {(dialogMode === 'retrait' || dialogMode === 'depot') && (
              <div>
                <Label htmlFor="od-transfer-montant">Montant (FCFA) *</Label>
                <Input
                  id="od-transfer-montant"
                  type="number"
                  value={formData.montant || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })
                  }
                  required
                  min="0"
                />
              </div>
            )}

            <div>
              <Label>Compte (partie) *</Label>
              <Select
                value={formData.partie}
                onValueChange={(v) => setFormData({ ...formData, partie: v as OdPartie })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OD_PARTIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(dialogMode === 'operation' || dialogMode === 'depense') && (
              <PaymentModePicker
                id="od-mode-paiement"
                label="Mode de paiement (optionnel)"
                value={formData.modePaiement}
                onChange={(mode) => setFormData((f) => ({ ...f, modePaiement: mode }))}
                entreprises={fournisseurs}
                allowNone
              />
            )}

            <div>
              <Label htmlFor="od-date">Date *</Label>
              <Input
                id="od-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="od-description">
                Description {(dialogMode === 'operation' || dialogMode === 'depense') ? '*' : '(optionnel)'}
              </Label>
              <Input
                id="od-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required={dialogMode === 'operation' || dialogMode === 'depense'}
                placeholder={
                  dialogMode === 'retrait' ? 'Ex: Retrait Orange Money'
                  : dialogMode === 'depot' ? 'Ex: Dépôt vers MTN'
                  : dialogMode === 'depense' ? 'Ex: Achat carburant, Paiement fournisseur...'
                  : ''
                }
              />
            </div>

            {(dialogMode === 'operation' || dialogMode === 'depense') && (
              <>
                <div>
                  <Label>Client (optionnel)</Label>
                  <ThirdPartyPicker
                    className="mt-1"
                    options={clients}
                    value={formData.clientTierId}
                    onValueChange={(clientTierId) =>
                      setFormData((f) => ({ ...f, clientTierId }))
                    }
                    placeholder="Rattacher un client..."
                    topChoices={[{ id: '', label: 'Aucun client' }]}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommandé pour les versements clients. Distinct de l&#39;utilisateur qui saisit.
                  </p>
                </div>

                {dialogMode === 'operation' && formData.type === 'entree' && (
                  <div className="rounded-lg border border-violet-200/80 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/25 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="od-exclut-revenu"
                        checked={formData.exclutRevenu}
                        onCheckedChange={(c) => {
                          const on = c === true;
                          setFormData((f) => ({
                            ...f,
                            exclutRevenu: on,
                          }));
                        }}
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="od-exclut-revenu" className="font-medium cursor-pointer flex items-center gap-1.5">
                          <Heart className="h-3.5 w-3.5 text-violet-600" />
                          Financement (hors encaissement / bénéfice)
                        </Label>
                        <p className="text-xs text-muted-foreground leading-snug">
                          Le montant augmente le solde OD mais n&#39;entre pas dans l&#39;encaissement du tableau de bord.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : dialogMode === 'retrait' ? (
                  'Retirer vers caisse'
                ) : dialogMode === 'depot' ? (
                  'Déposer depuis caisse'
                ) : dialogMode === 'depense' ? (
                  'Enregistrer la dépense'
                ) : editingOp ? (
                  'Modifier'
                ) : (
                  'Ajouter'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Solde global + par partie */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-primary" />
              Solde global OD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${totalSolde >= 0 ? 'text-primary' : 'text-red-600'}`}
            >
              {totalSolde.toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Entrées{activePartie !== 'all' ? ` (${activePartie})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600 tabular-nums">
              +{filteredStats.totalEntrees.toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Sorties{activePartie !== 'all' ? ` (${activePartie})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600 tabular-nums">
              {'−'}{filteredStats.totalSorties.toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comptes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{OD_PARTIES.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Mobile, banques, ch{'è'}que
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Soldes par partie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Soldes par compte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {OD_PARTIES.map((p) => {
              const solde = soldesByPartie[p];
              return (
                <button
                  key={p}
                  onClick={() => setActivePartie(activePartie === p ? 'all' : p)}
                  className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${
                    activePartie === p
                      ? 'ring-2 ring-primary shadow-md'
                      : ''
                  } ${PARTIE_COLORS[p]}`}
                >
                  <p className="text-xs font-semibold truncate">{p}</p>
                  <p
                    className={`text-lg font-bold tabular-nums mt-1 ${
                      solde >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600'
                    }`}
                  >
                    {solde.toLocaleString('fr-FR')}
                  </p>
                  <p className="text-[10px] opacity-70">FCFA</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs par partie + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="shrink-0">
              {activePartie !== 'all'
                ? `Opérations — ${activePartie}`
                : 'Toutes les opérations'}
            </CardTitle>
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-10"
              />
            </div>
          </div>
        </CardHeader>

        <Tabs
          value={activePartie}
          onValueChange={(v) => setActivePartie(v as 'all' | OdPartie)}
        >
          <div className="px-6 pb-2 overflow-x-auto">
            <TabsList className="inline-flex w-auto">
              <TabsTrigger value="all">Toutes</TabsTrigger>
              {OD_PARTIES.map((p) => (
                <TabsTrigger key={p} value={p}>
                  {p}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <CardContent className="pt-0">
            {filteredOps.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shuffle className="mx-auto h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Aucune opération diverse trouvée.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Compte</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Entrée</TableHead>
                      <TableHead className="text-right">Sortie</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Mode</TableHead>
                      {canManageTreasury && <TableHead className="w-20">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOps.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(op.date).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PARTIE_COLORS[op.partie]}>
                            {op.partie}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={op.type === 'entree' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {op.type === 'entree' ? 'Entrée' : 'Sortie'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-green-600 font-medium">
                          {op.type === 'entree'
                            ? `+${op.montant.toLocaleString('fr-FR')}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600 font-medium">
                          {op.type === 'sortie'
                            ? `−${op.montant.toLocaleString('fr-FR')}`
                            : '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {op.description}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {resolveClientName(op.clientTierId) || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {op.modePaiement || '—'}
                        </TableCell>
                        {canManageTreasury && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(op)}
                                className="h-8 w-8"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(op.id)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
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
        </Tabs>
      </Card>
    </div>
  );
}
