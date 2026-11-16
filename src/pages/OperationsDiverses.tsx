import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Search, Shuffle, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
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
  Shop: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  Account: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
};

export default function OperationsDiverses() {
  const { canManageTreasury, user } = useAuth();
  const [operations, setOperations] = useState<OperationDiverse[]>([]);
  const [activePartie, setActivePartie] = useState<'all' | OdPartie>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<OperationDiverse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isSubmitting, withGuard } = useSubmitGuard();

  const [formData, setFormData] = useState({
    partie: 'Yassa' as OdPartie,
    type: 'entree' as 'entree' | 'sortie',
    montant: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isRemote()) await refreshOdFromApi();
        if (!cancelled) setOperations(getOperationsDiverses());
      } catch (e) {
        console.error(e);
        toast.error('Impossible de charger les opérations diverses.');
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

  const resetForm = () => {
    setFormData({
      partie: activePartie !== 'all' ? activePartie : 'Yassa',
      type: 'entree',
      montant: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
    });
    setEditingOp(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const montant = Number(formData.montant);
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error('Indique un montant valide.');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('Ajoute une description.');
      return;
    }

    withGuard(async () => {
      const utilisateur = user?.login || 'Système';
      if (editingOp) {
        const updated: OperationDiverse = {
          ...editingOp,
          partie: formData.partie,
          type: formData.type,
          montant,
          date: formData.date,
          description: formData.description.trim(),
          reference: formData.reference.trim() || undefined,
          utilisateur,
        };
        if (isRemote()) {
          await saveOperationDiverseRemote(updated, editingOp.id);
          setOperations(getOperationsDiverses());
        } else {
          setOperations(updateOperationDiverseLocal(updated));
        }
        toast.success('Opération modifiée.');
      } else {
        const newOp: OperationDiverse = {
          id: crypto.randomUUID(),
          partie: formData.partie,
          type: formData.type,
          montant,
          date: formData.date,
          description: formData.description.trim(),
          reference: formData.reference.trim() || undefined,
          utilisateur,
        };
        if (isRemote()) {
          await saveOperationDiverseRemote(newOp);
          setOperations(getOperationsDiverses());
        } else {
          setOperations(addOperationDiverseLocal(newOp));
        }
        toast.success('Opération ajoutée.');
      }
      setIsDialogOpen(false);
      resetForm();
    });
  };

  const handleEdit = (op: OperationDiverse) => {
    setEditingOp(op);
    setFormData({
      partie: op.partie,
      type: op.type,
      montant: op.montant,
      date: op.date,
      description: op.description,
      reference: op.reference || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Supprimer cette opération ?')) return;
    withGuard(async () => {
      if (isRemote()) {
        await deleteOperationDiverseRemote(id);
        setOperations(getOperationsDiverses());
      } else {
        setOperations(deleteOperationDiverseLocal(id));
      }
      toast.success('Opération supprimée.');
    });
  };

  return (
    <div className="space-y-6 p-1">
      <PageHeader
        title="Opérations Diverses"
        icon={Shuffle}
        gradient="from-indigo-500/20 via-purple-500/10 to-transparent"
        actions={
          canManageTreasury ? (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle opération
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingOp ? 'Modifier l’opération' : 'Nouvelle opération diverse'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Partie *</Label>
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
                    <div>
                      <Label>Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(v: 'entree' | 'sortie') =>
                          setFormData({ ...formData, type: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entree">Entrée</SelectItem>
                          <SelectItem value="sortie">Sortie</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>

                  <div>
                    <Label htmlFor="od-description">Description *</Label>
                    <Input
                      id="od-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="od-reference">Référence (optionnel)</Label>
                    <Input
                      id="od-reference"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    />
                  </div>

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
          ) : undefined
        }
      />

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
              −{filteredStats.totalSorties.toLocaleString('fr-FR')} FCFA
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Parties actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{OD_PARTIES.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {OD_PARTIES.join(', ')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Soldes par partie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Soldes par partie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
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
                      <TableHead>Partie</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Entrée</TableHead>
                      <TableHead className="text-right">Sortie</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Référence</TableHead>
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
                          {op.reference || '—'}
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
