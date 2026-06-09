-- ============================================================
-- TAMIO LOGISTIKOU - Supabase Schema
-- ============================================================

-- Ενεργοποίηση κρυπτογράφησης
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ΧΡΗΣΤΕΣ & ROLES
-- ============================================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'viewer')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ΣΥΝΕΤΑΙΡΟΙ
-- ============================================================

CREATE TABLE partners (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  percentage NUMERIC(5,2) DEFAULT 0, -- ποσοστό συμμετοχής (προαιρετικό)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ΠΕΛΑΤΕΣ
-- ============================================================

CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('hond', 'lian')), -- χονδρική / λιανική
  name TEXT NOT NULL,
  afm TEXT,
  -- Κρυπτογραφημένα ευαίσθητα δεδομένα
  sensitive_data BYTEA, -- κρυπτογραφημένο JSON: {phone, email, taxisnet_user, taxisnet_pass, notes}
  -- Χονδρική
  period TEXT CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  invoice_amount NUMERIC(12,2) DEFAULT 0, -- βασικό ποσό τιμολογίου
  inc_stamp BOOLEAN DEFAULT TRUE,         -- εισπράττει χαρτόσημο 20%
  inc_vat BOOLEAN DEFAULT TRUE,           -- εισπράττει ΦΠΑ 24%
  vat_period TEXT CHECK (vat_period IN ('monthly', 'yearly')) DEFAULT 'monthly',
  extra_fee NUMERIC(12,2) DEFAULT 0,      -- έκτακτη αμοιβή
  -- Λιανική
  reason TEXT,
  reason_label TEXT,
  fee NUMERIC(12,2) DEFAULT 0,
  -- Κοινά
  opening_balance NUMERIC(12,2) DEFAULT 0, -- προηγούμενο υπόλοιπο κατά την εισαγωγή
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ΧΡΕΩΣΕΙΣ ΠΕΛΑΤΩΝ (μηνιαίες / τριμηνιαίες / ετήσιες)
-- ============================================================

CREATE TABLE client_charges (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  charge_type TEXT NOT NULL CHECK (charge_type IN ('monthly', 'quarterly', 'yearly', 'stamp', 'vat_yearly', 'extra', 'manual')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  is_auto BOOLEAN DEFAULT TRUE, -- αυτόματη ή χειροκίνητη
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(client_id, year, month, charge_type) -- αποφυγή διπλής χρέωσης
);

-- ============================================================
-- ΕΙΣΠΡΑΞΕΙΣ ΠΕΛΑΤΩΝ
-- ============================================================

CREATE TABLE client_receipts (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  receipt_date DATE NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  description TEXT,
  -- Αντιστοίχιση σε χρεώσεις (JSON array of charge ids)
  matched_charges JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- ΥΠΟΧΡΕΩΣΕΙΣ (σταθερές & περιοδικές)
-- ============================================================

CREATE TABLE obligations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  obligation_type TEXT NOT NULL CHECK (obligation_type IN ('fixed', 'periodic', 'employee')),
  -- fixed: τελευταία εργάσιμη μήνα
  -- periodic: συγκεκριμένη ημερομηνία
  -- employee: μισθοδοσία υπαλλήλου
  amount NUMERIC(12,2) DEFAULT 0,  -- 0 = ορίζεται κατά πληρωμή
  employee_name TEXT,              -- για τύπο employee
  due_day INT,                     -- ημέρα μήνα για periodic
  due_month INT,                   -- μήνας για ετήσιες υποχρεώσεις
  recurrence TEXT CHECK (recurrence IN ('monthly', 'quarterly', 'yearly', 'once')),
  next_due_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ΤΑΜΕΙΟ - ΚΙΝΗΣΕΙΣ
-- ============================================================

CREATE TABLE cashflow_entries (
  id BIGSERIAL PRIMARY KEY,
  entry_date DATE NOT NULL,
  week_start DATE NOT NULL, -- Δευτέρα της εβδομάδας
  year INT NOT NULL,
  month INT NOT NULL,
  week_number INT NOT NULL, -- εβδομάδα του έτους
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'receipt',      -- είσπραξη από πελάτη
    'expense_fixed',-- σταθερή υποχρέωση
    'expense_periodic', -- περιοδική υποχρέωση
    'expense_adhoc',-- έκτακτη πληρωμή
    'salary',       -- μισθοδοσία
    'distribution', -- διανομή συνεταίρου
    'transfer'      -- μεταφορά υπολοίπου πελάτη
  )),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  -- Συνδέσεις
  client_id BIGINT REFERENCES clients(id),
  client_receipt_id BIGINT REFERENCES client_receipts(id),
  obligation_id BIGINT REFERENCES obligations(id),
  partner_id BIGINT REFERENCES partners(id),
  -- Μεταδεδομένα
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- ΔΙΑΝΟΜΕΣ ΣΥΝΕΤΑΙΡΩΝ
-- ============================================================

CREATE TABLE partner_distributions (
  id BIGSERIAL PRIMARY KEY,
  partner_id BIGINT NOT NULL REFERENCES partners(id),
  amount NUMERIC(12,2) NOT NULL,
  distribution_date DATE NOT NULL,
  week_start DATE NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  description TEXT,
  cashflow_entry_id BIGINT REFERENCES cashflow_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- ΠΛΗΡΩΜΕΣ ΥΠΟΧΡΕΩΣΕΩΝ
-- ============================================================

CREATE TABLE obligation_payments (
  id BIGSERIAL PRIMARY KEY,
  obligation_id BIGINT NOT NULL REFERENCES obligations(id),
  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  description TEXT,
  cashflow_entry_id BIGINT REFERENCES cashflow_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT')),
  table_name TEXT,
  record_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ΡΥΘΜΙΣΕΙΣ ΕΦΑΡΜΟΓΗΣ
-- ============================================================

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Αρχικές ρυθμίσεις
INSERT INTO app_settings (key, value) VALUES
  ('last_auto_charge_date', NULL),
  ('encryption_hint', 'AES-256-GCM via pgcrypto'),
  ('app_name', 'Ταμείο Λογιστικού Γραφείου');

-- ============================================================
-- INDEXES για απόδοση
-- ============================================================

CREATE INDEX idx_cashflow_date ON cashflow_entries(entry_date);
CREATE INDEX idx_cashflow_week ON cashflow_entries(week_start);
CREATE INDEX idx_cashflow_year_month ON cashflow_entries(year, month);
CREATE INDEX idx_cashflow_type ON cashflow_entries(entry_type);
CREATE INDEX idx_client_charges_client ON client_charges(client_id);
CREATE INDEX idx_client_charges_year_month ON client_charges(year, month);
CREATE INDEX idx_client_receipts_client ON client_receipts(client_id);
CREATE INDEX idx_client_receipts_date ON client_receipts(receipt_date);
CREATE INDEX idx_clients_type ON clients(type);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_partner_dist_partner ON partner_distributions(partner_id);
CREATE INDEX idx_partner_dist_week ON partner_distributions(week_start);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligation_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper function: παίρνει το role του τρέχοντος χρήστη
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function: ελέγχει αν ο χρήστης είναι ενεργός
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS BOOLEAN AS $$
  SELECT is_active FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- USER PROFILES: ο καθένας βλέπει το δικό του, admin βλέπει όλα
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (get_user_role() = 'admin' OR id = auth.uid());

CREATE POLICY "user_profiles_delete" ON user_profiles
  FOR DELETE USING (get_user_role() = 'admin');

-- CLIENTS: όλοι βλέπουν, μόνο admin/user τροποποιούν
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (is_active_user());

CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (get_user_role() IN ('admin', 'user'));

CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (get_user_role() = 'admin');

-- CLIENT CHARGES
CREATE POLICY "charges_select" ON client_charges
  FOR SELECT USING (is_active_user());

CREATE POLICY "charges_insert" ON client_charges
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "charges_update" ON client_charges
  FOR UPDATE USING (get_user_role() IN ('admin', 'user'));

CREATE POLICY "charges_delete" ON client_charges
  FOR DELETE USING (get_user_role() = 'admin');

-- CLIENT RECEIPTS
CREATE POLICY "receipts_select" ON client_receipts
  FOR SELECT USING (is_active_user());

CREATE POLICY "receipts_insert" ON client_receipts
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "receipts_update" ON client_receipts
  FOR UPDATE USING (get_user_role() IN ('admin', 'user'));

CREATE POLICY "receipts_delete" ON client_receipts
  FOR DELETE USING (get_user_role() = 'admin');

-- CASHFLOW
CREATE POLICY "cashflow_select" ON cashflow_entries
  FOR SELECT USING (is_active_user());

CREATE POLICY "cashflow_insert" ON cashflow_entries
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "cashflow_update" ON cashflow_entries
  FOR UPDATE USING (get_user_role() IN ('admin', 'user'));

CREATE POLICY "cashflow_delete" ON cashflow_entries
  FOR DELETE USING (get_user_role() = 'admin');

-- OBLIGATIONS
CREATE POLICY "obligations_select" ON obligations
  FOR SELECT USING (is_active_user());

CREATE POLICY "obligations_insert" ON obligations
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "obligations_update" ON obligations
  FOR UPDATE USING (get_user_role() IN ('admin', 'user'));

CREATE POLICY "obligations_delete" ON obligations
  FOR DELETE USING (get_user_role() = 'admin');

-- OBLIGATION PAYMENTS
CREATE POLICY "obpay_select" ON obligation_payments
  FOR SELECT USING (is_active_user());

CREATE POLICY "obpay_insert" ON obligation_payments
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "obpay_delete" ON obligation_payments
  FOR DELETE USING (get_user_role() = 'admin');

-- PARTNERS
CREATE POLICY "partners_select" ON partners
  FOR SELECT USING (is_active_user());

CREATE POLICY "partners_insert" ON partners
  FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "partners_update" ON partners
  FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "partners_delete" ON partners
  FOR DELETE USING (get_user_role() = 'admin');

-- PARTNER DISTRIBUTIONS
CREATE POLICY "dist_select" ON partner_distributions
  FOR SELECT USING (is_active_user());

CREATE POLICY "dist_insert" ON partner_distributions
  FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'user'));

CREATE POLICY "dist_delete" ON partner_distributions
  FOR DELETE USING (get_user_role() = 'admin');

-- AUDIT LOG: μόνο admin
CREATE POLICY "audit_select" ON audit_log
  FOR SELECT USING (get_user_role() = 'admin');

CREATE POLICY "audit_insert" ON audit_log
  FOR INSERT WITH CHECK (TRUE); -- το σύστημα γράφει πάντα

-- APP SETTINGS
CREATE POLICY "settings_select" ON app_settings
  FOR SELECT USING (is_active_user());

CREATE POLICY "settings_update" ON app_settings
  FOR UPDATE USING (get_user_role() = 'admin');

-- ============================================================
-- FUNCTION: υπολογισμός υπολοίπου πελάτη
-- ============================================================

CREATE OR REPLACE FUNCTION get_client_balance(p_client_id BIGINT, p_year INT DEFAULT NULL)
RETURNS NUMERIC AS $$
DECLARE
  v_charges NUMERIC;
  v_receipts NUMERIC;
  v_opening NUMERIC;
BEGIN
  SELECT COALESCE(opening_balance, 0) INTO v_opening
  FROM clients WHERE id = p_client_id;

  IF p_year IS NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_charges
    FROM client_charges WHERE client_id = p_client_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_receipts
    FROM client_receipts WHERE client_id = p_client_id;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_charges
    FROM client_charges WHERE client_id = p_client_id AND year = p_year;

    SELECT COALESCE(SUM(amount), 0) INTO v_receipts
    FROM client_receipts WHERE client_id = p_client_id AND year = p_year;
  END IF;

  RETURN v_opening + v_charges - v_receipts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: υπολογισμός υπολοίπου ταμείου
-- ============================================================

CREATE OR REPLACE FUNCTION get_cashflow_balance(p_up_to_date DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC AS $$
DECLARE
  v_income NUMERIC;
  v_expenses NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM cashflow_entries
  WHERE entry_type = 'receipt' AND entry_date <= p_up_to_date;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM cashflow_entries
  WHERE entry_type IN ('expense_fixed','expense_periodic','expense_adhoc','salary','distribution','transfer')
  AND entry_date <= p_up_to_date;

  RETURN v_income - v_expenses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: εβδομαδιαία σύνοψη ταμείου
-- ============================================================

CREATE OR REPLACE FUNCTION get_weekly_summary(p_week_start DATE)
RETURNS TABLE(
  total_receipts NUMERIC,
  total_expenses NUMERIC,
  total_salaries NUMERIC,
  total_distributions NUMERIC,
  net_result NUMERIC,
  opening_balance NUMERIC,
  closing_balance NUMERIC
) AS $$
DECLARE
  v_week_end DATE := p_week_start + INTERVAL '6 days';
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'receipt' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type IN ('expense_fixed','expense_periodic','expense_adhoc') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'salary' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'distribution' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'receipt' THEN amount ELSE -amount END), 0),
    get_cashflow_balance(p_week_start - INTERVAL '1 day'),
    get_cashflow_balance(v_week_end)
  FROM cashflow_entries
  WHERE entry_date BETWEEN p_week_start AND v_week_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: συγκεντρωτική αναφορά περιόδου
-- ============================================================

CREATE OR REPLACE FUNCTION get_period_summary(p_from DATE, p_to DATE)
RETURNS TABLE(
  total_receipts NUMERIC,
  total_expenses_fixed NUMERIC,
  total_expenses_periodic NUMERIC,
  total_expenses_adhoc NUMERIC,
  total_salaries NUMERIC,
  total_distributions NUMERIC,
  net_result NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'receipt' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'expense_fixed' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'expense_periodic' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'expense_adhoc' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'salary' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'distribution' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'receipt' THEN amount ELSE -amount END), 0)
  FROM cashflow_entries
  WHERE entry_date BETWEEN p_from AND p_to;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
