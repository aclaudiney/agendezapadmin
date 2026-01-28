import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Clock, Save, AlertCircle, CheckCircle2, Building2, Phone, Mail, Calendar, MapPin, Loader } from 'lucide-react';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [erroCep, setErroCep] = useState('');

  const diasSemana = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' },
  ];

  const [formData, setFormData] = useState({
    nome_estabelecimento: '',
    email_estabelecimento: '',
    telefone_estabelecimento: '',
    whatsapp_numero: '',
    cep: '',
    rua: '',
    numero: '',
    cidade: '',
    estado: '',
    endereco: '',
    dias_abertura: {
      segunda: true,
      terca: true,
      quarta: true,
      quinta: true,
      sexta: true,
      sabado: false,
      domingo: false,
    },
    horario_segunda: '08:00-18:00',
    horario_terca: '08:00-18:00',
    horario_quarta: '08:00-18:00',
    horario_quinta: '08:00-18:00',
    horario_sexta: '08:00-18:00',
    horario_sabado: '08:00-18:00',
    horario_domingo: '08:00-18:00',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      
      // ✅ PEGAR company_id DO USUÁRIO LOGADO
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Erro: company_id não encontrado. Faça login novamente.');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando configurações para company_id:', companyId);

      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('company_id', companyId)  // ← FILTRAR PELO company_id DO USUÁRIO
        .single();  // ← Retorna um único registro

      if (error) {
        console.error('Erro ao buscar:', error);
        setErro('Erro ao carregar configurações');
        setLoading(false);
        return;
      }

      if (data) {
        const config = data;
        console.log('✅ Dados carregados:', config.nome_estabelecimento, `(${companyId})`);
        setFormData({
          nome_estabelecimento: config.nome_estabelecimento || '',
          email_estabelecimento: config.email_estabelecimento || '',
          telefone_estabelecimento: config.telefone_estabelecimento || '',
          whatsapp_numero: config.whatsapp_numero || '',
          cep: config.cep || '',
          rua: config.rua || '',
          numero: config.numero || '',
          cidade: config.cidade || '',
          estado: config.estado || '',
          endereco: config.endereco || `${config.rua || ''}${config.numero ? ', ' + config.numero : ''}${config.cidade ? ' - ' + config.cidade : ''}`,
          dias_abertura: config.dias_abertura || {
            segunda: true,
            terca: true,
            quarta: true,
            quinta: true,
            sexta: true,
            sabado: false,
            domingo: false,
          },
          horario_segunda: config.horario_segunda || '08:00-18:00',
          horario_terca: config.horario_terca || '08:00-18:00',
          horario_quarta: config.horario_quarta || '08:00-18:00',
          horario_quinta: config.horario_quinta || '08:00-18:00',
          horario_sexta: config.horario_sexta || '08:00-18:00',
          horario_sabado: config.horario_sabado || '08:00-18:00',
          horario_domingo: config.horario_domingo || '08:00-18:00',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setErro('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      setErroCep('CEP deve ter 8 dígitos');
      return;
    }

    try {
      setLoadingCep(true);
      setErroCep('');

      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        setErroCep('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        cep: cepLimpo,
        rua: data.logradouro || '',
        cidade: data.localidade || '',
        estado: data.uf || '',
      }));
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setErroCep('Erro ao buscar CEP');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      cep: value
    }));
    setErroCep('');
  };

  const handleCepBlur = () => {
    if (formData.cep.length >= 8) {
      buscarCep(formData.cep);
    }
  };

  const handleDiaChange = (dia: string) => {
    setFormData(prev => ({
      ...prev,
      dias_abertura: {
        ...prev.dias_abertura,
        [dia]: !prev.dias_abertura[dia as keyof typeof prev.dias_abertura]
      }
    }));
  };

  const handleHorarioChange = (dia: string, valor: string) => {
    setFormData(prev => ({
      ...prev,
      [`horario_${dia}`]: valor
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);

    try {
      setSaving(true);

      // ✅ PEGAR company_id
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Erro: company_id não encontrado');
        setSaving(false);
        return;
      }

      const enderecoCompleto = `${formData.rua}${formData.numero ? ', ' + formData.numero : ''}${formData.cidade ? ' - ' + formData.cidade : ''}`;

      const dadosParaSalvar = {
        company_id: companyId,  // ← INCLUIR company_id
        nome_estabelecimento: formData.nome_estabelecimento,
        email_estabelecimento: formData.email_estabelecimento,
        telefone_estabelecimento: formData.telefone_estabelecimento,
        whatsapp_numero: formData.whatsapp_numero,
        cep: formData.cep,
        rua: formData.rua,
        numero: formData.numero,
        cidade: formData.cidade,
        estado: formData.estado,
        endereco: enderecoCompleto,
        dias_abertura: formData.dias_abertura,
        horario_segunda: formData.horario_segunda,
        horario_terca: formData.horario_terca,
        horario_quarta: formData.horario_quarta,
        horario_quinta: formData.horario_quinta,
        horario_sexta: formData.horario_sexta,
        horario_sabado: formData.horario_sabado,
        horario_domingo: formData.horario_domingo,
      };

      // ✅ UPDATE pelo company_id (não pela primeira linha)
      const { error } = await supabase
        .from('configuracoes')
        .update(dadosParaSalvar)
        .eq('company_id', companyId);

      if (error) {
        console.error('Erro:', error);
        setErro('Erro ao salvar configurações: ' + error.message);
        return;
      }

      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } catch (error: any) {
      setErro('Erro ao salvar configurações: ' + error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Configurações</h2>
        <p className="text-slate-500">Gerencie os dados da sua loja, WhatsApp e horários de funcionamento</p>
      </header>

      <div className="max-w-4xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          {erro && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {sucesso && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 font-semibold">✓ Configurações salvas com sucesso!</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* SEÇÃO 1: DADOS DA LOJA */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Building2 size={24} className="text-indigo-600" />
                Dados do Estabelecimento
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nome */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    name="nome_estabelecimento"
                    value={formData.nome_estabelecimento}
                    onChange={handleChange}
                    placeholder="Ex: Meu Salão de Beleza"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                    <Mail size={16} /> Email
                  </label>
                  <input
                    type="email"
                    name="email_estabelecimento"
                    value={formData.email_estabelecimento}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                    <Phone size={16} /> Telefone
                  </label>
                  <input
                    type="tel"
                    name="telefone_estabelecimento"
                    value={formData.telefone_estabelecimento}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: ENDEREÇO COM CEP */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <MapPin size={24} className="text-indigo-600" />
                Endereço
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                {/* CEP */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    CEP
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="cep"
                      value={formData.cep}
                      onChange={handleCepChange}
                      onBlur={handleCepBlur}
                      placeholder="12345-678"
                      maxLength="9"
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {loadingCep && (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-3 bg-indigo-100 text-indigo-600 rounded-lg flex items-center gap-2"
                      >
                        <Loader size={18} className="animate-spin" />
                      </button>
                    )}
                  </div>
                  {erroCep && <p className="text-xs text-red-600 mt-1">{erroCep}</p>}
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
                  <input
                    type="text"
                    value={formData.estado}
                    disabled
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rua */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Rua</label>
                  <input
                    type="text"
                    value={formData.rua}
                    disabled
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
                  />
                </div>

                {/* Número */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Número</label>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleChange}
                    placeholder="Ex: 123"
                    className="w-full px-4 py-3 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Cidade</label>
                <input
                  type="text"
                  value={formData.cidade}
                  disabled
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-100 text-slate-600"
                />
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                💡 Digite o CEP e clique fora do campo para auto-completar. Depois preencha o número.
              </div>
            </div>

            {/* SEÇÃO 3: WHATSAPP */}
            <div className="border-b border-slate-200 pb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-6">💬 WhatsApp da Loja</h3>
              <p className="text-sm text-slate-600 mb-4">
                Este número será exibido para os clientes na página de agendamento para que possam entrar em contato.
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Número WhatsApp *
                </label>
                <input
                  type="tel"
                  name="whatsapp_numero"
                  value={formData.whatsapp_numero}
                  onChange={handleChange}
                  placeholder="55 11 99999-9999 (com código do país)"
                  className="w-full px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-green-700 mt-2">
                  💡 Use o formato: 55 11 99999-9999 (com código do país 55 para Brasil)
                </p>
              </div>
            </div>

            {/* SEÇÃO 4: HORÁRIOS POR DIA */}
            <div className="pb-8">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                <Calendar size={24} className="text-indigo-600" />
                Horário de Funcionamento por Dia
              </h3>

              <div className="space-y-4">
                {diasSemana.map((dia) => (
                  <div key={dia.key} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        id={dia.key}
                        checked={formData.dias_abertura[dia.key as keyof typeof formData.dias_abertura]}
                        onChange={() => handleDiaChange(dia.key)}
                        className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      />
                      
                      {/* Label do dia */}
                      <label htmlFor={dia.key} className="flex-1 font-medium text-slate-800 cursor-pointer">
                        {dia.label}
                      </label>

                      {/* Horário (só mostra se estiver marcado) */}
                      {formData.dias_abertura[dia.key as keyof typeof formData.dias_abertura] && (
                        <input
                          type="text"
                          value={formData[`horario_${dia.key}` as keyof typeof formData] as string}
                          onChange={(e) => handleHorarioChange(dia.key, e.target.value)}
                          placeholder="08:00-18:00"
                          className="w-32 px-3 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      )}

                      {/* Badge de fechado */}
                      {!formData.dias_abertura[dia.key as keyof typeof formData.dias_abertura] && (
                        <span className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full font-medium">
                          Fechado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>📅 Resumo:</strong> Marque os dias que está aberto e defina o horário (ex: 08:00-18:00)
                </p>
              </div>
            </div>

            {/* INFORMAÇÕES IMPORTANTES */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-2">ℹ️ Informações Importantes</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>✓ O WhatsApp será exibido no agendamento para contato do cliente</li>
                <li>✓ Os dias marcados determinam quando a loja está aberta</li>
                <li>✓ Os clientes só conseguem agendar em dias abertos dentro do horário</li>
                <li>✓ O CEP busca automaticamente rua e cidade via ViaCEP</li>
              </ul>
            </div>

            {/* Botão Salvar */}
            <div className="flex gap-3 pt-6 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={20} />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
