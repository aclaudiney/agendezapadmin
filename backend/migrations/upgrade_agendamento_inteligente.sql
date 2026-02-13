-- 1. ADICIONAR COLUNA VALOR SE NÃO EXISTIR
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agendamentos' AND column_name='valor') THEN
        ALTER TABLE agendamentos ADD COLUMN valor DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- 2. ATUALIZAR RPC DE SLOTS (SUPORTE A DURAÇÃO, PERÍODOS E HORÁRIOS FUTUROS)
CREATE OR REPLACE FUNCTION get_available_slots(
  p_company_id UUID,
  p_date DATE,
  p_service_id UUID DEFAULT NULL,
  p_barber_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 30,
  p_period TEXT DEFAULT 'todos' -- 'manha', 'tarde', 'noite', 'todos'
) RETURNS JSON AS $$
DECLARE
  v_slots TEXT[] := '{}';
  v_current_time TIME;
  v_start_time TIME := '08:00';
  v_end_time TIME := '20:00';
  v_booked_times RECORD;
  v_is_available BOOLEAN;
  v_check_time TIME;
  v_now_time TIME := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::TIME;
  v_is_today BOOLEAN := (p_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::DATE);
BEGIN
  -- Definir limites de período
  IF p_period = 'manha' THEN v_end_time := '12:00';
  ELSIF p_period = 'tarde' THEN v_start_time := '12:00'; v_end_time := '18:00';
  ELSIF p_period = 'noite' THEN v_start_time := '18:00';
  END IF;

  v_current_time := v_start_time;

  WHILE v_current_time < v_end_time LOOP
    -- 1. Se for hoje, ignora horários que já passaram
    IF v_is_today AND v_current_time <= v_now_time THEN
        v_current_time := v_current_time + INTERVAL '30 minutes';
        CONTINUE;
    END IF;

    v_is_available := TRUE;
    v_check_time := v_current_time;

    -- 2. Verificar se o slot (e os subsequentes se a duração for > 30min) estão livres
    WHILE v_check_time < (v_current_time + (p_duration_minutes || ' minutes')::INTERVAL) LOOP
        IF v_check_time >= v_end_time THEN
            v_is_available := FALSE;
            EXIT;
        END IF;

        -- Verifica se há algum agendamento que colide com este momento v_check_time
        SELECT 1 INTO v_is_available
        FROM agendamentos
        WHERE company_id = p_company_id
          AND data_agendamento = p_date
          AND status IN ('confirmado', 'pendente')
          AND profissional_id = p_barber_id
          AND v_check_time >= hora_agendamento 
          AND v_check_time < (hora_agendamento + INTERVAL '30 minutes'); -- Assume step de 30min

        IF FOUND THEN
            v_is_available := FALSE;
            EXIT;
        ELSE
            v_is_available := TRUE;
        END IF;

        v_check_time := v_check_time + INTERVAL '30 minutes';
    END LOOP;

    IF v_is_available THEN
      v_slots := array_append(v_slots, LEFT(v_current_time::TEXT, 5));
    END IF;
    
    v_current_time := v_current_time + INTERVAL '30 minutes';
  END LOOP;
  
  RETURN array_to_json(v_slots);
END;
$$ LANGUAGE plpgsql;

-- 3. ATUALIZAR RPC DE CRIAÇÃO (GRAVAR VALOR)
CREATE OR REPLACE FUNCTION create_appointment_atomic(
  p_company_id UUID,
  p_client_phone TEXT,
  p_date DATE,
  p_time TIME,
  p_service_id UUID,
  p_barber_id UUID,
  p_valor DECIMAL DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_client_id UUID;
  v_appointment_id UUID;
  v_conflict_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::TEXT || p_date::TEXT || p_time::TEXT || p_barber_id::TEXT));
  
  -- Verificar conflito (considerando a duração básica)
  SELECT COUNT(*) INTO v_conflict_count
  FROM agendamentos
  WHERE company_id = p_company_id
    AND data_agendamento = p_date
    AND hora_agendamento = p_time
    AND profissional_id = p_barber_id
    AND status IN ('confirmado', 'pendente');
  
  IF v_conflict_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Horário já ocupado');
  END IF;
  
  SELECT id INTO v_client_id FROM clientes WHERE telefone = p_client_phone AND company_id = p_company_id;
  IF v_client_id IS NULL THEN
    INSERT INTO clientes (company_id, telefone, created_at) VALUES (p_company_id, p_client_phone, NOW()) RETURNING id INTO v_client_id;
  END IF;
  
  INSERT INTO agendamentos (
    company_id, cliente_id, servico_id, profissional_id, 
    data_agendamento, hora_agendamento, status, origem, valor, created_at
  ) VALUES (
    p_company_id, v_client_id, p_service_id, p_barber_id, 
    p_date, p_time, 'confirmado', 'whatsapp', p_valor, NOW()
  ) RETURNING id INTO v_appointment_id;
  
  RETURN json_build_object('success', true, 'appointment_id', v_appointment_id);
END;
$$ LANGUAGE plpgsql;

-- 4. NOVA RPC PARA CANCELAMENTO COM REGRA DE 1 HORA E MOTIVO
CREATE OR REPLACE FUNCTION cancel_appointment_atomic(
  p_company_id UUID,
  p_appointment_id UUID,
  p_motivo TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_apt_timestamp TIMESTAMP;
  v_now TIMESTAMP := CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT (data_agendamento + hora_agendamento)::TIMESTAMP INTO v_apt_timestamp
  FROM agendamentos
  WHERE id = p_appointment_id AND company_id = p_company_id;

  IF v_apt_timestamp IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_apt_timestamp < (v_now + INTERVAL '1 hour') THEN
    RETURN json_build_object('success', false, 'error', 'Cancelamento permitido apenas com 1 hora de antecedência');
  END IF;

  UPDATE agendamentos 
  SET status = 'cancelado',
      observacao = COALESCE(p_motivo, observacao)
  WHERE id = p_appointment_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
