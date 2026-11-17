CREATE TABLE IF NOT EXISTS supplier_account_entries (
  id UUID PRIMARY KEY,
  "fournisseurId" UUID NOT NULL REFERENCES third_parties(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('depot', 'retrait', 'emprunt', 'remboursement')),
  montant DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(255),
  "supplierLoadingId" UUID,
  utilisateur VARCHAR(120),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sae_fournisseur ON supplier_account_entries ("fournisseurId");
CREATE INDEX IF NOT EXISTS idx_sae_date ON supplier_account_entries (date);
CREATE INDEX IF NOT EXISTS idx_sae_type ON supplier_account_entries (type);
