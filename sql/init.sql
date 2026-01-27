-- Tabela de Serviços
CREATE TABLE servicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Profissionais
CREATE TABLE profissionais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  especialidade VARCHAR(255),
  telefone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Clientes
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Agendamentos
CREATE TABLE agendamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT NOW()
);


-- Tabela de Usuários
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  nome_estabelecimento VARCHAR(255),
  telefone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir um usuário de teste
INSERT INTO usuarios (email, senha, nome_estabelecimento, telefone) 
VALUES ('admin@agendezap.com', 'admin123', 'Meu Salão', '11999999999');


-- Adicionar coluna duracao (em minutos) na tabela servicos
ALTER TABLE servicos ADD COLUMN duracao_minutos INTEGER DEFAULT 30;

-- Atualizar o serviço existente (Corte = 30 minutos)
UPDATE servicos SET duracao_minutos = 30 WHERE nome = 'Corte';


-- Criar tabela de configuracoes
CREATE TABLE configuracoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  horario_inicio VARCHAR(5) DEFAULT '08:00',
  horario_fim VARCHAR(5) DEFAULT '18:00',
  dias_funcionamento TEXT DEFAULT 'Segunda à Sexta',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configuracao padrao
INSERT INTO configuracoes (horario_inicio, horario_fim, dias_funcionamento)
VALUES ('08:00', '18:00', 'Segunda à Sexta');


ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS nome_estabelecimento TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS email_estabelecimento TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS telefone_estabelecimento TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS whatsapp_numero TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS dias_abertura JSONB DEFAULT '{"segunda": true, "terca": true, "quarta": true, "quinta": true, "sexta": true, "sabado": false, "domingo": false}';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_segunda TEXT DEFAULT '08:00-18:00';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_terca TEXT DEFAULT '08:00-18:00';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_quarta TEXT DEFAULT '08:00-18:00';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_quinta TEXT DEFAULT '08:00-18:00';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_sexta TEXT DEFAULT '08:00-18:00';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_sabado TEXT DEFAULT '08:00-18:00';
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS horario_domingo TEXT DEFAULT '08:00-18:00';


ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS estado TEXT;

ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cidade TEXT;


-- Políticas de acesso público para leitura
create policy "Allow public read"
on storage.objects for select
using (bucket_id = 'loja-imagens');

-- Políticas para upload autenticado
create policy "Allow authenticated upload"
on storage.objects for insert
with check (
  bucket_id = 'loja-imagens'
);

-- Políticas para atualizar
create policy "Allow authenticated update"
on storage.objects for update
with check (
  bucket_id = 'loja-imagens'
);

-- Adicionar coluna cor_tema
ALTER TABLE configuracoes 
ADD COLUMN cor_tema VARCHAR(7) DEFAULT '#6366f1';

-- Adicionar coluna imagem_capa
ALTER TABLE configuracoes 
ADD COLUMN imagem_capa TEXT;

-- Adicionar coluna descricao_loja
ALTER TABLE configuracoes 
ADD COLUMN descricao_loja TEXT;

-- Adicionar colunas de redes sociais
ALTER TABLE configuracoes 
ADD COLUMN facebook_url TEXT;

ALTER TABLE configuracoes 
ADD COLUMN instagram_url TEXT;

ALTER TABLE configuracoes 
ADD COLUMN linkedin_url TEXT;

ALTER TABLE configuracoes 
ADD COLUMN tiktok_url TEXT;

ALTER TABLE configuracoes 
ADD COLUMN youtube_url TEXT;

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS data_nascimento DATE;

ALTER TABLE clientes
ALTER COLUMN email DROP NOT NULL;

ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS data_nascimento DATE;

ALTER TABLE clientes
ALTER COLUMN email DROP NOT NULL;

CREATE TABLE agente_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_agente TEXT DEFAULT 'Atendente Virtual',
    prompt TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insira um registro inicial para podermos editar
INSERT INTO agente_config (nome_agente, prompt) 
VALUES ('Atendente Virtual', 'Você é um assistente simpático de uma barbearia.');

CREATE TABLE IF NOT EXISTS agente_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_agente TEXT DEFAULT 'Atendente Virtual',
    prompt TEXT DEFAULT 'Você é um assistente amigável.',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insira o primeiro registro para o front ter o que editar
INSERT INTO agente_config (nome_agente, prompt, ativo)
SELECT 'Atendente Virtual', 'Você é um assistente amigável.', true
WHERE NOT EXISTS (SELECT 1 FROM agente_config LIMIT 1);

INSERT INTO agente_config (nome_agente, prompt, ativo)
VALUES ('Atendente Virtual', 'Você é um assistente simpático.', true);

-- Garante que a tabela está certa
CREATE TABLE IF NOT EXISTS agente_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_agente TEXT DEFAULT 'Atendente Virtual',
    prompt TEXT DEFAULT 'Você é um assistente amigável.',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Deleta tudo o que tiver lá para não dar conflito
TRUNCATE agente_config;

-- Insere o registro que o Front-end vai carregar
INSERT INTO agente_config (nome_agente, prompt, ativo)
VALUES ('Atendente Virtual', 'Você é um assistente amigável de uma barbearia.', true);

-- 1. Garante que o RLS está ativo (as políticas só funcionam se isso estiver ON)
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas que podem estar conflitando
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.profissionais;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.servicos;

-- 3. Cria uma política ultra-aberta para testes (Anon e Authenticated)
CREATE POLICY "Acesso Total Leitura Profissionais" 
ON public.profissionais FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Acesso Total Leitura Servicos" 
ON public.servicos FOR SELECT 
TO anon, authenticated 
USING (true);

-- 4. Concede permissão de uso do esquema public (essencial para conexões externas)
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;


-- Adicionar coluna 'origem' na tabela 'agendamentos'
ALTER TABLE agendamentos
ADD COLUMN origem TEXT DEFAULT 'whatsapp_bot';

-- Comentário explicativo
COMMENT ON COLUMN agendamentos.origem IS 'Origem do agendamento: whatsapp_bot, web_form, gerente_app, etc';

CREATE POLICY "Allow public read on servicos"
ON servicos
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public write on servicos"
ON servicos
FOR ALL
TO public
USING (true);

-- Criar tabela despesas
CREATE TABLE despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data DATE NOT NULL,
  categoria TEXT,
  tipo TEXT DEFAULT 'despesa',
  created_at TIMESTAMP DEFAULT now()
);

-- Criar políticas RLS
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on despesas"
ON despesas
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public write on despesas"
ON despesas
FOR ALL
TO public
USING (true);

ALTER TABLE despesas
ADD COLUMN forma_pagamento TEXT DEFAULT 'Dinheiro';

-- Criar coluna de data como TEXT em vez de DATE
ALTER TABLE despesas
ALTER COLUMN data TYPE TEXT;

-- Ou (se quiser manter como DATE)
-- Execute isto no seu código JavaScript antes de salvar:
-- const dataLocal = new Date(formDespesa.data + 'T00:00:00');