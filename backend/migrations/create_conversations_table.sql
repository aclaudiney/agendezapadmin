-- Migração para garantir a estrutura correta da tabela de conversas
-- Esta tabela armazena o histórico de mensagens entre a IA e o cliente

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_phone TEXT NOT NULL,
  company_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_phone, company_id)
);

-- Índice para busca rápida por telefone e empresa
CREATE INDEX IF NOT EXISTS idx_conversations_lookup 
ON conversations(client_phone, company_id);

-- Comentário para documentação do banco
COMMENT ON TABLE conversations IS 'Armazena o histórico de chat da IA com clientes (Multi-tenant)';
