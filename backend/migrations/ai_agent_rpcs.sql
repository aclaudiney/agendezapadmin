-- ============================================
-- MIGRATION: AI Agent Function Calling RPCs (RELOAD SCHEMA V4)
-- ============================================

-- IMPORTANTE: Remover funções antigas para atualizar a assinatura. 
-- O Postgres exige DROP se a lista de argumentos mudar.
DROP FUNCTION IF EXISTS get_available_slots(uuid, date, uuid, uuid);
DROP FUNCTION IF EXISTS get_available_slots(uuid, date, uuid, uuid, integer, text);
DROP FUNCTION IF EXISTS create_appointment_atomic(uuid, text, date, time, uuid, uuid);
DROP FUNCTION IF EXISTS create_appointment_atomic(uuid, text, date, time, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS create_appointment_atomic(uuid, text, text, date, time, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS cancel_appointment_atomic(uuid, uuid, text);
DROP FUNCTION IF EXISTS cancel_appointment_atomic(uuid, uuid);

-- 1. RPC para buscar horários disponíveis considerando a duração real de cada serviço (Resiliente)
CREATE OR REPLACE FUNCTION get_available_slots(
  p_company_id UUID,
  p_date DATE,
  p_service_id UUID DEFAULT NULL,
  p_profissional_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 30,
  p_period TEXT DEFAULT 'todos'
) RETURNS JSON AS $$
DECLARE
  v_slots TEXT[] := '{}';
  v_current_time TIME;
  v_end_day TIME;
  v_overlap_count INTEGER;
  v_slot_end TIME;
  v_config_horario TEXT;
  v_dia_semana TEXT;
  v_is_aberto BOOLEAN;
BEGIN
  -- 1. Buscar Horário de Funcionamento Real da Empresa
  v_dia_semana := TRIM(LOWER(to_char(p_date, 'day')));
  -- Mapear dia da semana para o nome da coluna (pt-br simplificado sem acento)
  -- to_char(..., 'day') retorna nomes em inglês por padrão ou depende do LC_TIME
  -- Vamos usar extract(dow) que é universal
  CASE extract(dow from p_date)
    WHEN 0 THEN v_dia_semana := 'domingo';
    WHEN 1 THEN v_dia_semana := 'segunda';
    WHEN 2 THEN v_dia_semana := 'terca';
    WHEN 3 THEN v_dia_semana := 'quarta';
    WHEN 4 THEN v_dia_semana := 'quinta';
    WHEN 5 THEN v_dia_semana := 'sexta';
    WHEN 6 THEN v_dia_semana := 'sabado';
  END CASE;

  -- Buscar na tabela configuracoes
  SELECT 
    CASE v_dia_semana
      WHEN 'segunda' THEN horario_segunda
      WHEN 'terca' THEN horario_terca
      WHEN 'quarta' THEN horario_quarta
      WHEN 'quinta' THEN horario_quinta
      WHEN 'sexta' THEN horario_sexta
      WHEN 'sabado' THEN horario_sabado
      WHEN 'domingo' THEN horario_domingo
    END,
    (dias_abertura->>v_dia_semana)::BOOLEAN
  INTO v_config_horario, v_is_aberto
  FROM configuracoes 
  WHERE company_id = p_company_id;

  -- Se não houver config ou estiver marcado como fechado, retorna vazio
  IF v_is_aberto = false OR v_config_horario IS NULL OR v_config_horario = 'FECHADO' THEN
    RETURN '[]'::JSON;
  END IF;

  -- Extrair abertura e fechamento (ex: "08:00-18:00")
  v_current_time := split_part(v_config_horario, '-', 1)::TIME;
  v_end_day := split_part(v_config_horario, '-', 2)::TIME;

  -- Filtro de Períodos (Ajustado ao horário de funcionamento)
  IF p_period = 'manha' THEN 
    -- Manhã: da abertura até as 12:00
    v_end_day := LEAST(v_end_day, '12:00'::TIME);
  ELSIF p_period = 'tarde' THEN 
    -- Tarde: das 12:00 até as 18:00
    v_current_time := GREATEST(v_current_time, '12:00'::TIME);
    v_end_day := LEAST(v_end_day, '18:00'::TIME);
  ELSIF p_period = 'noite' THEN 
    -- Noite: das 18:00 até o fechamento
    v_current_time := GREATEST(v_current_time, '18:00'::TIME);
  END IF;

  -- Garantir que o início não seja maior que o fim após os filtros de período
  IF v_current_time > v_end_day THEN
    RETURN '[]'::JSON;
  END IF;

  WHILE v_current_time <= v_end_day LOOP
    v_slot_end := v_current_time + (p_duration_minutes || ' minutes')::INTERVAL;
    
    -- Lógica de disponibilidade
    -- Retornamos um objeto com o horário e a lista de profissionais livres
    DECLARE
      v_free_profs TEXT[];
    BEGIN
      IF p_profissional_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_overlap_count FROM agendamentos a
        LEFT JOIN servicos s ON a.servico_id = s.id
        WHERE a.company_id = p_company_id AND a.data_agendamento = p_date AND a.status IN ('confirmado', 'pendente', 'finalizado')
          AND a.profissional_id = p_profissional_id
          AND ((v_current_time < (a.hora_agendamento + (COALESCE(s.duracao, 30) || ' minutes')::INTERVAL)) AND (v_slot_end > a.hora_agendamento));
        
        IF v_overlap_count = 0 THEN
          SELECT ARRAY_AGG(nome) INTO v_free_profs FROM profissionais WHERE id = p_profissional_id;
        END IF;
      ELSE
        -- Busca global: Pega todos os profissionais que NÃO estão ocupados neste slot
        SELECT ARRAY_AGG(p.nome) INTO v_free_profs
        FROM profissionais p
        WHERE p.company_id = p_company_id AND p.ativo = true
          AND NOT EXISTS (
            SELECT 1 FROM agendamentos a
            LEFT JOIN servicos s ON a.servico_id = s.id
            WHERE a.company_id = p_company_id AND a.data_agendamento = p_date AND a.status IN ('confirmado', 'pendente', 'finalizado')
              AND a.profissional_id = p.id
              AND ((v_current_time < (a.hora_agendamento + (COALESCE(s.duracao, 30) || ' minutes')::INTERVAL)) AND (v_slot_end > a.hora_agendamento))
          );
      END IF;

      IF v_free_profs IS NOT NULL AND array_length(v_free_profs, 1) > 0 THEN
        v_slots := array_append(v_slots, json_build_object(
          'time', LEFT(v_current_time::TEXT, 5),
          'professionals', v_free_profs
        )::TEXT);
      END IF;
    END;
    
    v_current_time := v_current_time + INTERVAL '30 minutes';
  END LOOP;
  
  RETURN ('[' || array_to_string(v_slots, ',') || ']')::JSON;
END;
$$ LANGUAGE plpgsql;

-- 2. RPC para criar agendamento de forma atômica (Resiliente e Completo)
CREATE OR REPLACE FUNCTION create_appointment_atomic(
  p_company_id UUID,
  p_client_phone TEXT,
  p_client_name TEXT,
  p_date DATE,
  p_time TIME,
  p_service_id UUID,
  p_profissional_id UUID,
  p_valor DECIMAL DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_client_id UUID;
  v_appointment_id UUID;
  v_overlap_count INTEGER;
  v_duration INTEGER;
  v_end_time TIME;
BEGIN
  -- Lock por Profissional e Data para evitar duplicidade no mesmo instante
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::TEXT || p_date::TEXT || p_profissional_id::TEXT));
  
  -- Pega duração para validar o novo bloqueio
  SELECT duracao INTO v_duration FROM servicos WHERE id = p_service_id AND company_id = p_company_id;
  v_duration := COALESCE(v_duration, 30);
  v_end_time := p_time + (v_duration || ' minutes')::INTERVAL;

  -- Validação de overlap final antes de inserir
  SELECT COUNT(*)
  INTO v_overlap_count
  FROM agendamentos a
  LEFT JOIN servicos s ON a.servico_id = s.id
  WHERE a.company_id = p_company_id
    AND a.data_agendamento = p_date
    AND a.profissional_id = p_profissional_id
    AND a.status IN ('confirmado', 'pendente', 'finalizado')
    AND (
      (p_time < (a.hora_agendamento + (COALESCE(s.duracao, 30) || ' minutes')::INTERVAL))
      AND (v_end_time > a.hora_agendamento)
    );
  
  IF v_overlap_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Horário indisponível devido a outro agendamento neste período.');
  END IF;
  
  -- Gestão de Cliente: Busca ou Cria/Atualiza Nome
  SELECT id INTO v_client_id FROM clientes WHERE telefone = p_client_phone AND company_id = p_company_id;
  
  IF v_client_id IS NULL THEN
    INSERT INTO clientes (company_id, telefone, created_at, nome, ativo)
    VALUES (p_company_id, p_client_phone, NOW(), COALESCE(p_client_name, 'Cliente WhatsApp'), true)
    RETURNING id INTO v_client_id;
  ELSE
    IF (p_client_name IS NOT NULL AND p_client_name <> 'Cliente WhatsApp') THEN
      UPDATE clientes SET nome = p_client_name, ativo = true WHERE id = v_client_id;
    ELSE
      UPDATE clientes SET ativo = true WHERE id = v_client_id;
    END IF;
  END IF;
  
  -- 1. Inserir na tabela agendamentos
  INSERT INTO agendamentos (
    company_id, cliente_id, servico_id, profissional_id, 
    data_agendamento, hora_agendamento, status, origem, created_at, valor
  ) VALUES (
    p_company_id, v_client_id, p_service_id, p_profissional_id, 
    p_date, p_time, 'confirmado', 'whatsapp', NOW(), p_valor
  ) RETURNING id INTO v_appointment_id;

  -- 2. Inserir na tabela agendamento_servicos (Para consistência com o sistema completo)
  INSERT INTO agendamento_servicos (
    agendamento_id, servico_id, valor, created_at
  ) VALUES (
    v_appointment_id, p_service_id, p_valor, NOW()
  );
  
  RETURN json_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'client_name', p_client_name,
    'valor', p_valor
  );
END;
$$ LANGUAGE plpgsql;

-- 3. RPC para cancelar agendamento com validação de empresa e regra de tempo
CREATE OR REPLACE FUNCTION cancel_appointment_atomic(
  p_company_id UUID,
  p_appointment_id UUID,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_count INTEGER;
  v_apt_time TIMESTAMPTZ;
BEGIN
  -- Verifica se o agendamento pertence à empresa
  SELECT count(*) INTO v_count 
  FROM agendamentos 
  WHERE id = p_appointment_id AND company_id = p_company_id;

  IF v_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado ou não pertence a esta empresa.');
  END IF;

  -- Regra de 1h (Opcional, mas recomendado para evitar cancelamentos em cima da hora)
  SELECT (data_agendamento + hora_agendamento)::TIMESTAMPTZ INTO v_apt_time
  FROM agendamentos WHERE id = p_appointment_id;

  IF v_apt_time < (NOW() + INTERVAL '1 hour') THEN
    -- Apenas um aviso, mas permitimos cancelar (ou pode bloquear mudando para RETURN false)
    -- RETURN json_build_object('success', false, 'error', 'Cancelamento permitido apenas com 1h de antecedência.');
  END IF;

  UPDATE agendamentos 
  SET status = 'cancelado', 
      observacao = COALESCE(observacao, '') || ' | Motivo cancelamento: ' || COALESCE(p_motivo, 'Não informado')
  WHERE id = p_appointment_id AND company_id = p_company_id;

  RETURN json_build_object('success', true, 'message', 'Agendamento cancelado com sucesso.');
END;
$$ LANGUAGE plpgsql;
