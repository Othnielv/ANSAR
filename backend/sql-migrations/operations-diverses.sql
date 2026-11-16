-- Opérations Diverses : table séparée du brouillard de caisse,
-- ventilée par partie (Yassa, Afb, CCA, SGC, Top Mobile, Crédit du Sahel, Shop, Account).

CREATE TABLE IF NOT EXISTS operations_diverses (
  id          VARCHAR(128) PRIMARY KEY,
  partie      VARCHAR(60)  NOT NULL,
  type        VARCHAR(20)  NOT NULL CHECK (type IN ('entree', 'sortie')),
  montant     DECIMAL(15,2) NOT NULL,
  date        DATE         NOT NULL,
  description TEXT         NOT NULL,
  reference   VARCHAR(255),
  utilisateur VARCHAR(120),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_od_partie ON operations_diverses (partie);
CREATE INDEX IF NOT EXISTS idx_od_date   ON operations_diverses (date);
