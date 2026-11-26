-- Lien traçabilité entre opérations Camrail et trajets.

ALTER TABLE camrail_operations
  ADD COLUMN IF NOT EXISTS "tripId" UUID REFERENCES trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_camrail_operations_trip_id ON camrail_operations ("tripId");

COMMENT ON COLUMN camrail_operations."tripId" IS 'Trajet d''origine pour les attributions Camrail depuis la page Trajets.';
