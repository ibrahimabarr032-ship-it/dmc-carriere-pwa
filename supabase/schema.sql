-- ==============================================================================
-- DYNASTY MINING COMPANY (DMC) - BOUSSOURA SAND QUARRY (KINDIA)
-- SUPABASE POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS) & AUDIT TRAIL
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
CREATE TYPE user_role_enum AS ENUM ('AGENT_TERRAIN', 'POINTEUR', 'PROPRIETAIRE', 'ADMINISTRATEUR');
CREATE TYPE tax_type_enum AS ENUM ('PER_TRUCK', 'PER_M3', 'PERCENTAGE');
CREATE TYPE expense_category_enum AS ENUM ('FUEL', 'MAINTENANCE', 'FOOD', 'SITE_FEES', 'OTHER', 'CARBURANT', 'REPARATION_ENGIN', 'SALAIRE_JOURNALIER', 'FRAIS_COMMUNAUTAIRES', 'AUTRE');

-- 3. USERS & PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.user_accounts (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'POINTEUR',
    pin_code TEXT NOT NULL DEFAULT '1234',
    avatar_color TEXT NOT NULL DEFAULT '#10b981',
    phone TEXT,
    site_name TEXT NOT NULL DEFAULT 'Carrière Boussoura (Kindia)',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TRUCK MODELS CATALOGUE & TARIFFS
CREATE TABLE IF NOT EXISTS public.truck_models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_price_gnf NUMERIC(15, 2) NOT NULL,
    axle_count INTEGER NOT NULL DEFAULT 3,
    icon_type TEXT NOT NULL DEFAULT 'medium',
    capacity_m3 NUMERIC(8, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TAX CONFIGURATION
CREATE TABLE IF NOT EXISTS public.tax_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount_gnf NUMERIC(15, 2) NOT NULL DEFAULT 15000,
    tax_type tax_type_enum NOT NULL DEFAULT 'PER_TRUCK',
    beneficiary TEXT NOT NULL DEFAULT 'Commune Rurale / Ministère des Mines',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. LOADINGS (TRAÇABILITÉ DES CHARGEMENTS DE SABLE)
CREATE TABLE IF NOT EXISTS public.loadings (
    id TEXT PRIMARY KEY,
    truck_model_id TEXT NOT NULL REFERENCES public.truck_models(id) ON DELETE RESTRICT,
    truck_model_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_gnf NUMERIC(15, 2) NOT NULL,
    total_price_gnf NUMERIC(15, 2) NOT NULL,
    tax_amount_gnf NUMERIC(15, 2) NOT NULL DEFAULT 15000,
    truck_plate TEXT,
    client_name TEXT,
    loading_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id TEXT NOT NULL,
    created_by_user_name TEXT NOT NULL,
    is_deferred_entry BOOLEAN NOT NULL DEFAULT FALSE,
    deferred_reason TEXT,
    closure_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EXPENSES & OPEX (CARBURANT, ENTRETIEN, DÉPENSES CHANTIER)
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category expense_category_enum NOT NULL DEFAULT 'CARBURANT',
    amount_gnf NUMERIC(15, 2) NOT NULL,
    liters_fuel NUMERIC(10, 2),
    price_per_liter_gnf NUMERIC(15, 2),
    description TEXT NOT NULL,
    receipt_photo_url TEXT,
    created_by_user_id TEXT NOT NULL,
    created_by_user_name TEXT NOT NULL,
    closure_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DAILY CLOSURES (CLÔTURES JOURNALIÈRES SCELLÉES)
CREATE TABLE IF NOT EXISTS public.daily_closures (
    id TEXT PRIMARY KEY,
    closure_date DATE NOT NULL UNIQUE,
    total_trucks INTEGER NOT NULL DEFAULT 0,
    gross_revenue_gnf NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_taxes_gnf NUMERIC(15, 2) NOT NULL DEFAULT 0,
    fuel_expenses_gnf NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opex_expenses_gnf NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_margin_gnf NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_locked BOOLEAN NOT NULL DEFAULT TRUE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by_user_id TEXT NOT NULL,
    locked_by_user_name TEXT NOT NULL,
    supervisor_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AUDIT LOGS (REGISTRE INVIOLABLE D'AUDIT)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role user_role_enum NOT NULL,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INDEXES FOR HIGH QUERY SPEED
CREATE INDEX IF NOT EXISTS idx_loadings_time ON public.loadings(loading_time DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_closures_date ON public.daily_closures(closure_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time ON public.audit_logs(timestamp DESC);

-- 11. ROW LEVEL SECURITY (RLS) POLICIES (ENABLE ALL ACCESS FOR PWA SYNC WITH ANON KEY)
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loadings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read policies (allow sync queries)
CREATE POLICY "Read user_accounts" ON public.user_accounts FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Read truck_models" ON public.truck_models FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Read tax_configs" ON public.tax_configs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Read loadings" ON public.loadings FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Read expenses" ON public.expenses FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Read daily_closures" ON public.daily_closures FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Read audit_logs" ON public.audit_logs FOR SELECT TO authenticated, anon USING (true);

-- Insert policies with validation
CREATE POLICY "Insert loadings" ON public.loadings FOR INSERT TO authenticated, anon WITH CHECK (id IS NOT NULL);
CREATE POLICY "Insert expenses" ON public.expenses FOR INSERT TO authenticated, anon WITH CHECK (id IS NOT NULL);
CREATE POLICY "Insert daily_closures" ON public.daily_closures FOR INSERT TO authenticated, anon WITH CHECK (id IS NOT NULL);
CREATE POLICY "Insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated, anon WITH CHECK (id IS NOT NULL);

-- Update policies
CREATE POLICY "Update user_accounts" ON public.user_accounts FOR UPDATE TO authenticated, anon USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "Update truck_models" ON public.truck_models FOR UPDATE TO authenticated, anon USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "Update tax_configs" ON public.tax_configs FOR UPDATE TO authenticated, anon USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
CREATE POLICY "Update loadings" ON public.loadings FOR UPDATE TO authenticated, anon USING (id IS NOT NULL);
CREATE POLICY "Update expenses" ON public.expenses FOR UPDATE TO authenticated, anon USING (id IS NOT NULL);

-- 12. INITIAL SEED DATA
INSERT INTO public.user_accounts (id, full_name, role, pin_code, avatar_color, site_name, is_active)
VALUES 
  ('usr_admin_1', 'Ibrahim Barry (Super-Admin)', 'ADMINISTRATEUR', '0000', '#10b981', 'Direction Générale DMC', true),
  ('usr_owner_1', 'Directeur / Propriétaire DMC', 'PROPRIETAIRE', '9999', '#3b82f6', 'Carrière Boussoura', true),
  ('usr_agent_1', 'Mamadou Diallo (Pointeur Jour)', 'POINTEUR', '1234', '#059669', 'Carrière Boussoura', true),
  ('usr_agent_2', 'Aboubacar Soumah (Pointeur Nuit)', 'POINTEUR', '5678', '#6366f1', 'Carrière Boussoura', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.truck_models (id, name, default_price_gnf, axle_count, icon_type, is_active, display_order)
VALUES 
  ('trk_6roues', '6 Roues (Standard)', 350000, 2, 'small', true, 1),
  ('trk_10roues', '10 Roues (Sinotruk Howo)', 650000, 3, 'medium', true, 2),
  ('trk_12roues', '12 Roues (Heavy European)', 900000, 4, 'heavy', true, 3),
  ('trk_remorque', 'Remorque / Semi (40t+)', 1400000, 5, 'heavy', true, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tax_configs (id, name, amount_gnf, tax_type, beneficiary, is_active)
VALUES 
  ('tax_commune', 'Taxe Extraction Boussoura', 15000, 'PER_TRUCK', 'Commune Rurale de Kindia', true)
ON CONFLICT (id) DO NOTHING;
