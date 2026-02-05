-- ========================================================
-- MIGRATION: UPDATE SCHEMA V2 (Billing & Auth)
-- ========================================================

-- 1. Atualizar Tabela de Empresas com Campos de Faturamento
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS setup_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- 2. Criar Tabela de Usuários (Acesso Interno/Empresas)
-- Nota: Esta tabela é usada pelo backend para gerenciar logins das empresas
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    nome TEXT,
    role TEXT DEFAULT 'empresa', -- 'admin' ou 'empresa'
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar Realtime para a tabela de usuários (Opcional, mas útil)
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios;

-- 4. Atualizar Tabela de Configurações com Colunas Faltantes
ALTER TABLE public.configuracoes
ADD COLUMN IF NOT EXISTS hora_abertura TEXT DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS hora_fechamento TEXT DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS intervalo_agendamento INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS dias_funcionamento INTEGER[] DEFAULT '{1,2,3,4,5}';

-- 5. Garantir que as configurações tenham restrições de unicidade (se não existirem)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_config_company') THEN
        ALTER TABLE public.configuracoes ADD CONSTRAINT unique_config_company UNIQUE (company_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_agente_company') THEN
        ALTER TABLE public.agente_config ADD CONSTRAINT unique_agente_company UNIQUE (company_id);
    END IF;
END $$;
