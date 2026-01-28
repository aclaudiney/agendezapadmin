-- 1. Tabela de Empresas
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

-- 2. Tabela de Perfis (Acessos)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  company_id UUID REFERENCES companies(id), -- O ID da empresa que ele manda
  role TEXT DEFAULT 'admin' -- 'superadmin' ou 'admin'
);

-- 3. Inserir as 3 Empresas
INSERT INTO companies (name, slug) VALUES 
('Dom Barão', 'dom-barao'),
('Studio Takata', 'studio-takata'),
('West Side', 'west-side')
ON CONFLICT (slug) DO NOTHING;

-- 1. Garante que as empresas existam e pega os IDs delas
-- (Rode isso primeiro para garantir que as empresas estão lá)
INSERT INTO companies (name, slug) VALUES 
('Dom Barão', 'dom-barao'),
('Studio Takata', 'studio-takata'),
('West Side', 'west-side')
ON CONFLICT (slug) DO NOTHING;

-- 2. Vincula os usuários aos seus cargos e empresas
-- Substitua os IDs abaixo pelos que você copiou no passo anterior

-- SEU ACESSO (SUPER ADMIN)
INSERT INTO profiles (id, email, role) 
VALUES ('ID-DO-ADMIN-AGENDEZAP', 'admin@agendezap.com', 'superadmin');

-- ACESSO DOM BARÃO
INSERT INTO profiles (id, email, company_id, role) 
VALUES (
  'ID-DO-DOM-BARAO', 
  'dombarao@admin.com', 
  (SELECT id FROM companies WHERE slug = 'dom-barao'), 
  'admin'
);

-- ACESSO TAKATA
INSERT INTO profiles (id, email, company_id, role) 
VALUES (
  'ID-DO-TAKATA', 
  'studiotakata@admin.com', 
  (SELECT id FROM companies WHERE slug = 'studio-takata'), 
  'admin'
);

-- ACESSO WEST SIDE
INSERT INTO profiles (id, email, company_id, role) 
VALUES (
  'ID-DO-WESTSIDE', 
  'westside@admin.com', 
  (SELECT id FROM companies WHERE slug = 'west-side'), 
  'admin'
);



--- NOVA TABELA PARA GERENCIAR SESSÕES DO WHATSAPP ---


-- Tabela para gerenciar as instâncias do robô por empresa
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  session_name TEXT UNIQUE NOT NULL, -- Ex: 'dom-barao-session'
  status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'qrcode'
  qr_code TEXT, -- Guardaremos o Base64 do QR para exibir no seu painel
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar Realtime para essa tabela (importante para o QR Code aparecer na tela na hora)
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_sessions;





--- ADICIONAR COLUNA 'ACTIVE' NA TABELA DE EMPRESAS ---

-- Adiciona a coluna 'active' na tabela de empresas
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Garante que as 3 empresas que já criamos fiquem como ATIVAS
UPDATE public.companies SET active = TRUE;

--- Adiciona uma restrição para garantir que cada empresa tenha apenas uma sessão do WhatsApp

ALTER TABLE public.whatsapp_sessions 
ADD CONSTRAINT whatsapp_sessions_company_id_key UNIQUE (company_id);





-- Torna a coluna session_name opcional para não travar o sistema
ALTER TABLE public.whatsapp_sessions 
ALTER COLUMN session_name DROP NOT NULL;



---- Tabela de Clientes ----



-- Adiciona coluna last_connected_at para rastrear a última conexão bem-sucedida

-- Cria a tabela de clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome TEXT,
    telefone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita o Realtime para facilitar a visualização depois
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;




-- 1. Tabela de Configurações da Loja
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome_estabelecimento TEXT,
    horario_segunda TEXT DEFAULT '08:00-18:00',
    horario_terca TEXT DEFAULT '08:00-18:00',
    horario_quarta TEXT DEFAULT '08:00-18:00',
    horario_quinta TEXT DEFAULT '08:00-18:00',
    horario_sexta TEXT DEFAULT '08:00-18:00',
    horario_sabado TEXT DEFAULT '09:00-13:00',
    horario_domingo TEXT DEFAULT 'FECHADO',
    dias_abertura JSONB DEFAULT '{"segunda": true, "terca": true, "quarta": true, "quinta": true, "sexta": true, "sabado": true, "domingo": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Configuração da IA (Agente)
CREATE TABLE IF NOT EXISTS public.agente_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome_agente TEXT DEFAULT 'Maia',
    prompt TEXT,
    link_booking TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Serviços
CREATE TABLE IF NOT EXISTS public.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    duracao INT DEFAULT 30, -- minutos
    ativo BOOLEAN DEFAULT TRUE
);

-- 4. Tabela de Profissionais
CREATE TABLE IF NOT EXISTS public.profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE
);

-- 5. Tabela de Agendamentos (Caso ainda não tenha)
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id),
    servico_id UUID REFERENCES public.servicos(id),
    profissional_id UUID REFERENCES public.profissionais(id),
    data_agendamento DATE NOT NULL,
    hora_agendamento TIME NOT NULL,
    status TEXT DEFAULT 'pendente',
    origem TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- POPULANDO DADOS DE TESTE (DOM BARÃO)
-- Substitua os IDs abaixo pelos IDs reais da sua tabela 'companies'
-- ==========================================

-- Exemplo para uma empresa (Repita para as outras trocando o ID):
-- INSERT INTO public.configuracoes (company_id, nome_estabelecimento) 
-- VALUES ('ID_DA_DOM_BARAO', 'Dom Barão Barbearia');

-- INSERT INTO public.agente_config (company_id, nome_agente, prompt, link_booking) 
-- VALUES ('ID_DA_DOM_BARAO', 'Bento', 'Você é o Bento, barbeiro da Dom Barão. Seja descontraído.', 'https://agendezap.com/dombarao');






-- Garante que cada empresa tenha apenas UMA configuração de loja e UMA de agente
ALTER TABLE public.configuracoes ADD CONSTRAINT unique_config_company UNIQUE (company_id);
ALTER TABLE public.agente_config ADD CONSTRAINT unique_agente_company UNIQUE (company_id);



-- Agora o comando vai funcionar perfeitamente!
INSERT INTO public.configuracoes (company_id, nome_estabelecimento) 
VALUES ('356e0a46-b1b3-4a70-8138-edd7b42e6b87', 'Dom Barão Barbearia')
ON CONFLICT (company_id) DO UPDATE SET nome_estabelecimento = 'Dom Barão Barbearia';

INSERT INTO public.agente_config (company_id, nome_agente, prompt, link_booking, ativo) 
VALUES ('356e0a46-b1b3-4a70-8138-edd7b42e6b87', 'Bento', 'Você é o Bento, assistente da Dom Barão. Seja educado e focado em agendamentos.', 'https://agendezap.com/dombarao', true)
ON CONFLICT (company_id) DO UPDATE SET nome_agente = 'Bento';

INSERT INTO public.servicos (company_id, nome, preco, duracao)
VALUES ('356e0a46-b1b3-4a70-8138-edd7b42e6b87', 'Corte de Cabelo', 50.00, 30);