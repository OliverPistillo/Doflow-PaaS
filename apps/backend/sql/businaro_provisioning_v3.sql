CREATE SCHEMA IF NOT EXISTS businaro;

CREATE TYPE businaro.product_type_enum AS ENUM (
  'RAW_MATERIAL','SEMI_FINISHED','COMMERCIAL','ASSEMBLY','FINISHED_PRODUCT','SERVICE_EXTERNAL'
);

CREATE TYPE businaro.department_enum AS ENUM (
  'ADMIN','TECH_OFFICE','WAREHOUSE','MACHINE_TOOLS','ASSEMBLY','PAINTING','PURCHASING','PROD_DIRECTOR'
);

CREATE TYPE businaro.stock_status_enum AS ENUM (
  'AVAILABLE','COMMITTED','QC_PENDING','QUARANTINE','SCRAP'
);

CREATE TYPE businaro.condition_grade_enum AS ENUM (
  'NEW','REFURBISHED','USED_AS_IS','DAMAGED'
);

CREATE TYPE businaro.job_order_type_enum AS ENUM (
  'PRODUCTION_NEW','SERVICE','INTERNAL'
);

CREATE TABLE businaro.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_quarantine BOOLEAN DEFAULT FALSE
);

CREATE TABLE businaro.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES businaro.warehouses(id),
  code VARCHAR(50) NOT NULL,
  description TEXT,
  UNIQUE(warehouse_id, code)
);

CREATE TABLE businaro.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type businaro.product_type_enum NOT NULL,
  uom VARCHAR(10) DEFAULT 'PZ',
  min_stock_level INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE businaro.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role businaro.department_enum NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE businaro.inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES businaro.products(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES businaro.locations(id) ON DELETE RESTRICT,
  batch_number VARCHAR(100),
  serial_number VARCHAR(100),
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  status businaro.stock_status_enum NOT NULL DEFAULT 'AVAILABLE',
  condition businaro.condition_grade_enum NOT NULL DEFAULT 'NEW',
  UNIQUE(product_id, location_id, batch_number, serial_number, status, condition)
);

CREATE TABLE businaro.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_lot_id UUID REFERENCES businaro.inventory_lots(id),
  product_id UUID,
  job_order_id UUID,
  delta NUMERIC(12,4) NOT NULL,
  from_status businaro.stock_status_enum,
  to_status businaro.stock_status_enum,
  reason VARCHAR(100) NOT NULL,
  operator_id UUID,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed magazzini
INSERT INTO businaro.warehouses (code, name, is_quarantine) VALUES
('MAIN', 'Magazzino Centrale', FALSE),
('QUARANTINE', 'Area Quarantena / Resi', TRUE),
('PROD_LINE', 'Bordo Linea Produzione', FALSE)
ON CONFLICT DO NOTHING;

-- Seed locations
INSERT INTO businaro.locations (warehouse_id, code, description)
SELECT id, 'ARRIVI', 'Area Accettazione Merce' FROM businaro.warehouses WHERE code='MAIN'
ON CONFLICT DO NOTHING;

INSERT INTO businaro.locations (warehouse_id, code, description)
SELECT id, 'SCAFFALE-A1', 'Corsia A Ripiano 1' FROM businaro.warehouses WHERE code='MAIN'
ON CONFLICT DO NOTHING;

INSERT INTO businaro.locations (warehouse_id, code, description)
SELECT id, 'RESI-IN', 'Gabbia Resi da Verificare' FROM businaro.warehouses WHERE code='QUARANTINE'
ON CONFLICT DO NOTHING;

-- Seed users master reparto
INSERT INTO businaro.users (email, first_name, last_name, role) VALUES
('admin@businaro.com','Admin','Globale','ADMIN'),
('ufficio.tecnico@businaro.com','Ufficio','Tecnico','TECH_OFFICE'),
('magazzino@businaro.com','Postazione','Magazzino','WAREHOUSE'),
('macchine@businaro.com','Reparto','Macchine Utensili','MACHINE_TOOLS'),
('assemblaggio@businaro.com','Reparto','Assemblaggio','ASSEMBLY'),
('verniciatura@businaro.com','Reparto','Verniciatura','PAINTING'),
('acquisti@businaro.com','Ufficio','Acquisti','PURCHASING'),
('direzione@businaro.com','Direttore','Produzione','PROD_DIRECTOR')
ON CONFLICT DO NOTHING;
