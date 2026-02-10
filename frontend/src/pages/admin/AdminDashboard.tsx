import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { adminService } from '../../services/adminService';
import { Plus, Eye, Trash2, Power, Loader, Lock, Unlock, X, AlertCircle, Copy, Check, DollarSign, TrendingUp, Building2, BarChart3, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Empresa {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created_at: string;
  descricao?: string;
  whatsapp_number?: string;
  whatsapp_status?: string;
  whatsapp_qr?: string;
  setup_fee?: number;
  monthly_fee?: number;
  subscription_status?: string;
  stats?: {
    total_clientes: number;
    total_profissionais: number;
    total_servicos: number;
  };
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];

const AdminDashboard: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCredenciaisModal, setShowCredenciaisModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [credenciais, setCredenciais] = useState<any>(null);
  const [copiado, setCopiado] = useState(false);

  // ✅ CARREGAR EMPRESAS E ANALYTICS AO ABRIR
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    await Promise.all([
      carregarEmpresas(),
      carregarAnalytics()
    ]);
  };

  const carregarAnalytics = async () => {
    try {
      // 1. Vendas por categoria (pie chart)
      const data = await adminService.getSalesByCategory();
      setChartData(data);

      // 2. Faturamento mensal (estimado das empresas)
      // (Isso já é feito via redução de empresas.length no faturamento_mensal)
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    }
  };

  const carregarEmpresas = async () => {
    try {
      setLoading(true);
      setErro('');
      const data = await adminService.listarEmpresas();
      setEmpresas(data.companies || []);
    } catch (error: any) {
      setErro('Erro ao carregar empresas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ BLOQUEAR/DESBLOQUEAR EMPRESA
  const handleToggleBloqueio = async (companyId: string, estadoAtual: boolean) => {
    const novoEstado = !estadoAtual;
    const acao = novoEstado ? 'ativar' : 'bloquear';

    if (!window.confirm(`Tem certeza que deseja ${acao} esta empresa?`)) return;

    try {
      await adminService.atualizarEmpresa(companyId, { active: novoEstado });
      setErro('');
      await carregarEmpresas();
      toast.success(`Empresa ${novoEstado ? 'ativada' : 'bloqueada'} com sucesso!`);
    } catch (error) {
      toast.error(`Erro ao ${acao} empresa`);
      console.error(error);
    }
  };

  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const copiarParaAreaTransferencia = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success('Copiado para a área de transferência!');
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Cálculos de métricas
  const faturamentoMensal = empresas.reduce((acc, e) => acc + (e.monthly_fee || 0), 0);
  const empresasAtivas = empresas.filter(e => e.active).length;
  const empresasBloqueadas = empresas.length - empresasAtivas;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">SuperAdmin</h1>
          <p className="text-slate-500 mt-1">Gerencie o ecossistema AgendeZap e monitore o crescimento global.</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-semibold transition-all hover:scale-[1.02] shadow-sm"
        >
          <Plus size={20} />
          Nova Empresa
        </button>
      </div>

      {/* ERRO */}
      {erro && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <AlertCircle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700 font-medium">{erro}</p>
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* TOTAL EMPRESAS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-indigo-50 transition-colors">
              <Building2 size={20} className="text-slate-900 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-emerald-600">
              <TrendingUp size={14} /> +12%
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Total de Empresas</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{empresas.length}</h3>
          <p className="text-xs text-slate-400 mt-1">cadastradas no sistema</p>
        </div>

        {/* FATURAMENTO MENSAL */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-emerald-50 transition-colors">
              <DollarSign size={20} className="text-slate-900 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div className="flex items-center gap-1 text-sm font-bold text-emerald-600">
              <ArrowUpRight size={14} /> 8.4%
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Receita Mensal (MRR)</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatarMoeda(faturamentoMensal)}</h3>
          <p className="text-xs text-slate-400 mt-1">estimado em assinaturas</p>
        </div>

        {/* EMPRESAS ATIVAS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <Check size={20} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">OPERANTE</span>
          </div>
          <p className="text-sm font-medium text-slate-500">Empresas Ativas</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{empresasAtivas}</h3>
          <p className="text-xs text-slate-400 mt-1">com acesso liberado</p>
        </div>

        {/* BLOQUEADAS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-rose-50 rounded-xl">
              <Lock size={20} className="text-rose-600" />
            </div>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">INATIVAS</span>
          </div>
          <p className="text-sm font-medium text-slate-500">Bloqueadas</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{empresasBloqueadas}</h3>
          <p className="text-xs text-slate-400 mt-1">acesso restrito</p>
        </div>
      </div>

      {/* MIDDLE SECTION: CHARTS & RECENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* DISTRIBUIÇÃO DE SERVIÇOS */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-1">Serviços Populares</h3>
          <p className="text-sm text-slate-400 mb-8">Uso global por categoria</p>

          <div className="h-[220px] relative">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {chartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 size={40} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">Sem dados globais</p>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-black text-slate-900">{chartData.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Categorias</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mt-8">
            {chartData.map((entry, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  <span className="text-sm font-semibold text-slate-600">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* LISTA RESUMIDA DE EMPRESAS */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Empresas Recentes</h3>
              <p className="text-sm text-slate-400 mt-0.5">Últimos cadastros realizados</p>
            </div>
            <button className="text-indigo-600 text-sm font-bold hover:underline">Ver todas</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-50">
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Mensalidade</th>
                  <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {empresas.slice(0, 5).map((empresa) => (
                  <tr key={empresa.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
                          {empresa.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{empresa.name}</p>
                          <p className="text-xs text-slate-400 font-medium">Criada em {formatarData(empresa.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${empresa.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                        }`}>
                        {empresa.active ? 'ATIVA' : 'BLOQUEADA'}
                      </span>
                    </td>
                    <td className="py-4">
                      <p className="font-bold text-slate-900 text-sm">{formatarMoeda(empresa.monthly_fee || 0)}</p>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleVerDetalhes(empresa)}
                          className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                          title="Detalhes"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleBloqueio(empresa.id, empresa.active)}
                          className={`p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all ${empresa.active ? 'text-slate-400 hover:text-amber-600' : 'text-slate-400 hover:text-emerald-600'}`}
                          title={empresa.active ? 'Bloquear' : 'Desbloquear'}
                        >
                          {empresa.active ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: VER DETALHES */}
      {showDetailModal && selectedEmpresa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-800">{selectedEmpresa.name}</h2>
                <p className="text-slate-500 mt-1">{selectedEmpresa.slug}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* INFO GERAL */}
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-slate-800">Informações Gerais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">ID</p>
                    <p className="text-sm font-mono text-slate-700">{selectedEmpresa.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Criado em</p>
                    <p className="text-sm text-slate-700">{formatarData(selectedEmpresa.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="text-sm text-slate-700">{selectedEmpresa.active ? '✅ Ativa' : '🔒 Bloqueada'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <p className="text-sm text-slate-700">{selectedEmpresa.whatsapp_status === 'connected' ? '📱 Conectado' : '⏳ Desconectado'}</p>
                  </div>
                </div>
              </div>

              {/* AÇÕES */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    handleToggleBloqueio(selectedEmpresa.id, selectedEmpresa.active);
                    setShowDetailModal(false);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors text-white ${selectedEmpresa.active
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700'
                    }`}
                >
                  {selectedEmpresa.active ? '🔒 Bloquear' : '🔓 Desbloquear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREDENCIAIS */}
      {showCredenciaisModal && credenciais && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={24} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Empresa Criada!</h2>
              <p className="text-slate-500 mt-2">Salve as credenciais abaixo</p>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 mb-1">EMAIL</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={credenciais.email}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-sm"
                  />
                  <button
                    onClick={() => copiarParaAreaTransferencia(credenciais.email)}
                    className="p-2 hover:bg-slate-200 rounded transition-colors"
                  >
                    {copiado ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">SENHA</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={credenciais.senha}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded text-sm"
                  />
                  <button
                    onClick={() => copiarParaAreaTransferencia(credenciais.senha)}
                    className="p-2 hover:bg-slate-200 rounded transition-colors"
                  >
                    {copiado ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center mt-4">Passe essas credenciais para o cliente acessar o painel</p>

            <button
              onClick={() => {
                setShowCredenciaisModal(false);
                carregarEmpresas();
              }}
              className="w-full mt-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Pronto!
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR EMPRESA */}
      {showCreateModal && (
        <CreateCompanyModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(cred) => {
            setShowCreateModal(false);
            setCredenciais(cred);
            setShowCredenciaisModal(true);
            carregarEmpresas();
          }}
        />
      )}
    </div>
  );
};

// ============================================
// MODAL CRIAR EMPRESA
// ============================================
interface CreateCompanyModalProps {
  onClose: () => void;
  onSuccess: (credenciais: any) => void;
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({ onClose, onSuccess }) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [setupFee, setSetupFee] = useState(0);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      setErro('Nome da empresa é obrigatório');
      return;
    }

    try {
      setLoading(true);
      setErro('');

      const resposta = await adminService.criarEmpresa(
        nome,
        descricao || undefined,
        undefined,
        setupFee,
        monthlyFee
      );

      // ✅ MOSTRAR CREDENCIAIS
      if (resposta.credenciais) {
        onSuccess(resposta.credenciais);
      }

      setNome('');
      setDescricao('');
      setSetupFee(0);
      setMonthlyFee(0);
    } catch (error: any) {
      setErro('Erro ao criar empresa');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-300">
        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <Plus className="text-indigo-600" />
          Nova Empresa
        </h2>

        {erro && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 mb-6 flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{erro}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Nome da Empresa *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Barbearia do João"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Valor Setup (R$)
              </label>
              <input
                type="number"
                value={setupFee}
                onChange={(e) => setSetupFee(Number(e.target.value))}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                Mensalidade (R$)
              </label>
              <input
                type="number"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              Observações
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium resize-none"
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Criar Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;