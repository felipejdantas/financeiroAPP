-- Create categorias table
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  cor VARCHAR(7), -- Hex color code
  icone VARCHAR(50), -- Icon name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, nome)
);

-- Enable RLS
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own categories"
  ON categorias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON categorias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categorias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categorias FOR DELETE
  USING (auth.uid() = user_id);

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_categorias_updated_at ON categorias;
CREATE TRIGGER update_categorias_updated_at
  BEFORE UPDATE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update all expenses when category name changes
CREATE OR REPLACE FUNCTION update_despesas_categoria()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nome != NEW.nome THEN
    UPDATE despesas
    SET "Categoria" = NEW.nome
    WHERE "Categoria" = OLD.nome
      AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on categorias table for cascade updates
DROP TRIGGER IF EXISTS cascade_categoria_update ON categorias;
CREATE TRIGGER cascade_categoria_update
  AFTER UPDATE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION update_despesas_categoria();

-- Migrate existing categories from despesas table
INSERT INTO categorias (user_id, nome, created_at)
SELECT DISTINCT 
  user_id,
  "Categoria" as nome,
  MIN(created_at) as created_at
FROM despesas
WHERE "Categoria" IS NOT NULL 
  AND "Categoria" != ''
GROUP BY user_id, "Categoria"
ON CONFLICT (user_id, nome) DO NOTHING;
