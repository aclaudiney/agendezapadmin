import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient'; 
import { Bot, Save, Power, Loader2, AlertCircle } from 'lucide-react';

const Agents: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [config, setConfig] = useState({ 
    id: '', 
    nome_agente: '', 
    prompt: '', 
    ativo: true,
    company_id: ''
  });

  // ✅ CARREGA OS DADOS DO SUPABASE COM FILTRO POR COMPANY_ID
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setErro('');

      // ✅ PEGAR COMPANY_ID DO LOCALSTORAGE
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando configuração de agente para company_id:', companyId);

      // ✅ BUSCAR APENAS DA EMPRESA ATUAL
      const { data, error } = await supabase
        .from('agente_config')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error) {
        console.error("❌ Erro ao carregar:", error);
        // Se não encontrar, criar padrão
        setConfig({
          id: '',
          nome_agente: 'Assistente AgendeZap',
          prompt: 'Você é um assistente simpático e profissional de agendamento. Responda com cortesia e ajude os clientes a agendar serviços.',
          ativo: true,
          company_id: companyId
        });
      } else if (data) {
        console.log('✅ Configuração carregada:', data);
        setConfig({
          id: data.id,
          nome_agente: data.nome_agente || '',
          prompt: data.prompt || '',
          ativo: data.ativo ?? true,
          company_id: data.company_id
        });
      }
    } catch (err) {
      console.error("❌ Erro crítico ao carregar configurações:", err);
      setErro('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  // ✅ SALVA OS DADOS NO SUPABASE COM COMPANY_ID
  const handleSave = async () => {
    if (!config.nome_agente.trim() || !config.prompt.trim()) {
      setErro('Preencha nome do agente e instruções');
      return;
    }

    setSaving(true);
    setErro('');

    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      console.log('💾 Salvando configuração de agente...');

      if (config.id) {
        // ✅ ATUALIZAR EXISTENTE
        const { error } = await supabase
          .from('agente_config')
          .update({ 
            nome_agente: config.nome_agente, 
            prompt: config.prompt, 
            ativo: config.ativo,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id)
          .eq('company_id', companyId);

        if (error) {
          console.error('❌ Erro ao atualizar:', error);
          setErro('Erro ao salvar: ' + error.message);
          return;
        }

        console.log('✅ Configuração atualizada com sucesso!');
      } else {
        // ✅ CRIAR NOVO
        const { data, error } = await supabase
          .from('agente_config')
          .insert([{
            company_id: companyId,
            nome_agente: config.nome_agente,
            prompt: config.prompt,
            ativo: config.ativo,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) {
          console.error('❌ Erro ao criar:', error);
          setErro('Erro ao salvar: ' + error.message);
          return;
        }

        if (data) {
          setConfig(prev => ({...prev, id: data.id}));
        }

        console.log('✅ Configuração criada com sucesso!');
      }

      alert('✅ Agente atualizado com sucesso!');
      setErro('');
    } catch (err: any) {
      console.error('❌ Erro crítico ao salvar:', err);
      setErro('Erro de conexão com o banco de dados');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Configuração de Agente AI</h2>
        <p className="text-slate-500">Ajuste o comportamento do seu robô no WhatsApp.</p>
      </header>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Coluna de Status */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`p-4 rounded-full ${config.ativo ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
              <Bot size={40} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{config.nome_agente || "Sem Nome"}</h3>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {config.ativo ? "● Online" : "○ Offline"}
              </p>
            </div>
            <button 
              onClick={() => setConfig({...config, ativo: !config.ativo})}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors ${
                config.ativo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
              }`}
            >
              <Power size={16} />
              {config.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        </div>

        {/* Coluna de Edição */}
        <div className="lg:col-span-3 bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">NOME DO AGENTE</label>
            <input 
              type="text"
              className="w-full md:w-1/2 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={config.nome_agente}
              onChange={(e) => setConfig({...config, nome_agente: e.target.value})}
              placeholder="Ex: Assistente AgendeZap"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Instruções de Comportamento (Prompt)</label>
            <textarea
              className="w-full h-80 p-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm bg-slate-50"
              value={config.prompt}
              onChange={(e) => setConfig({...config, prompt: e.target.value})}
              placeholder="Digite como o robô deve responder..."
            />
            <p className="text-xs text-slate-500 mt-2">
              💡 Dica: Descreva o tom, comportamento e contexto que o agente deve usar ao atender clientes.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              SALVAR CONFIGURAÇÕES
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agents;