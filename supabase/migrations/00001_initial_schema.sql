-- Create foundation tables that don't depend on other tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create divisions table
CREATE TABLE IF NOT EXISTS public.divisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    primary_contact_name VARCHAR(200),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create craft types table for labor categories
CREATE TABLE IF NOT EXISTS public.craft_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    category VARCHAR(20) NOT NULL CHECK (category IN ('direct', 'indirect', 'staff')),
    default_rate DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_divisions_code ON public.divisions(code) WHERE is_active = true;
CREATE INDEX idx_divisions_active ON public.divisions(is_active);
CREATE INDEX idx_clients_code ON public.clients(code) WHERE is_active = true;
CREATE INDEX idx_clients_active ON public.clients(is_active);
CREATE INDEX idx_craft_types_category ON public.craft_types(category) WHERE is_active = true;
CREATE INDEX idx_craft_types_code ON public.craft_types(code) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for divisions (all authenticated users can view)
CREATE POLICY "authenticated_users_view_divisions" ON public.divisions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for clients (all authenticated users can view)
CREATE POLICY "authenticated_users_view_clients" ON public.clients
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policies for craft_types (all authenticated users can view)
CREATE POLICY "authenticated_users_view_craft_types" ON public.craft_types
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_divisions_updated_at
    BEFORE UPDATE ON public.divisions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_craft_types_updated_at
    BEFORE UPDATE ON public.craft_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial data for divisions
INSERT INTO public.divisions (name, code) VALUES
    ('Civil', 'CIV'),
    ('Structural', 'STR'),
    ('Mechanical', 'MEC'),
    ('Electrical', 'ELE'),
    ('Industrial', 'IND'),
    ('Environmental', 'ENV')
ON CONFLICT (code) DO NOTHING;

-- Insert initial data for craft types
INSERT INTO public.craft_types (name, code, category, default_rate) VALUES
    -- Direct labor
    ('Carpenter', 'CARP', 'direct', 65.00),
    ('Electrician', 'ELEC', 'direct', 75.00),
    ('Pipefitter', 'PIPE', 'direct', 72.00),
    ('Ironworker', 'IRON', 'direct', 70.00),
    ('Equipment Operator', 'EQOP', 'direct', 68.00),
    ('Laborer', 'LABR', 'direct', 45.00),
    -- Indirect labor
    ('Foreman', 'FORM', 'indirect', 85.00),
    ('Safety', 'SAFE', 'indirect', 60.00),
    ('QC Inspector', 'QCIN', 'indirect', 65.00),
    -- Staff
    ('Project Manager', 'PMGR', 'staff', 120.00),
    ('Project Engineer', 'PENG', 'staff', 95.00),
    ('Superintendent', 'SUPT', 'staff', 110.00),
    ('Admin', 'ADMN', 'staff', 50.00)
ON CONFLICT (code) DO NOTHING;

-- Insert sample clients
INSERT INTO public.clients (name, code, city, state) VALUES
    ('Acme Corporation', 'ACME', 'Houston', 'TX'),
    ('Global Energy Partners', 'GEP', 'Dallas', 'TX'),
    ('Industrial Solutions Inc', 'ISI', 'Austin', 'TX'),
    ('Texaco Refining', 'TEX', 'Corpus Christi', 'TX'),
    ('Dow Chemical Company', 'DOW', 'Freeport', 'TX')
ON CONFLICT (code) DO NOTHING;