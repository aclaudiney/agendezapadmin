import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Plus, Eye, Trash2, Power, Loader, Lock, Unlock, X, AlertCircle, Copy, Check, DollarSign, TrendingUp, Building2, BarChart3 } from 'lucide-react';
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
      const data = await adminService.getSalesByCategory();
      setChartData(data);
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    }
  };

  // ✅ CORRIGIDO - NÃO TENTA BUSCAR STATS QUE CAUSAM ERRO
  const carregarEmpresas = async () => {
    try {
      setLoading(true);
      setErro('');
      const data = await adminService.listarEmpresas();

      // ✅ USA OS DADOS DIRETO SEM BUSCAR STATS NOVAMENTE
      setEmpresas(data.companies || []);
    } catch (error: any) {
      setErro('Erro ao carregar empresas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ VER DETALHES DA EMPRESA
  const handleVerDetalhes = async (empresa: Empresa) => {
    try {
      const detalhes = await adminService.getEmpresa(empresa.id);
      setSelectedEmpresa(detalhes.empresa);
      setShowDetailModal(true);
    } catch (error) {
      setErro('Erro ao carregar detalhes da empresa');
    }
  };

  // ✅ DELETAR EMPRESA
  const handleDeletarEmpresa = async (companyId: string, nomEmpresa: string) => {
    if (!window.confirm(`Tem certeza que deseja DELETAR a empresa "${nomEmpresa}"? Essa ação não pode ser desfeita!`)) return;

    try {
      await adminService.desativarEmpresa(companyId);
      setErro('');
      await carregarEmpresas();
    } catch (error: any) {
      setErro(`Erro ao deletar empresa: ${error.message || 'Verifique se existem agendamentos ou outros registros vinculados'}`);
      console.error('❌ Erro completo ao deletar:', error);
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
    } catch (error) {
      setErro(`Erro ao ${acao} empresa`);
      console.error(error);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copiarParaAreaTransferencia = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">SuperAdmin</h1>
          <p className="text-slate-500 mt-1">Gerenciar todas as empresas do sistema</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Plus size={20} />
          Nova Empresa
        </button>
      </div>

      {/* ERRO */}
      {erro && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {/* STATS & CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Total de Empresas */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Building2 size={80} className="text-indigo-600" />
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total de Empresas</p>
          <p className="text-5xl font-black text-slate-900 mt-2">{empresas.length}</p>
          <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-bold">
            <TrendingUp size={16} />
            <span>+12% este mês</span>
          </div>
        </div>

        {/* Faturamento Estimado (Setup + Mensalidades) */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={80} className="text-emerald-600" />
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Faturamento (Mensal)</p>
          <p className="text-5xl font-black text-slate-900 mt-2">
            R$ {empresas.reduce((acc, e) => acc + (e.monthly_fee || 0), 0).toFixed(2)}
          </p>
          <p className="mt-4 text-slate-400 text-xs font-medium">Excluindo valores de Setup único</p>
        </div>

        {/* Distribuição de Vendas (Pie Chart) */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl lg:row-span-2">
          <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" />
            Distribuição de Serviços
          </h3>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BarChart3 size={40} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">Sem dados suficientes</p>
              </div>
            )}
          </div>
        </div>

        {/* Ativas vs Bloqueadas */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl relative overflow-hidden grid grid-cols-2 gap-4">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Empresas Ativas</p>
            <p className="text-4xl font-black text-green-600 mt-1">{empresas.filter(e => e.active).length}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Bloqueadas</p>
            <p className="text-4xl font-black text-red-600 mt-1">{empresas.filter(e => !e.active).length}</p>
          </div>
        </div>
      </div>

      {/* TABELA DE EMPRESAS */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50/50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Faturamento</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">WhatsApp</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Ações</th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                {/* Nome */}
                <td className="px-6 py-4">
                  <div>
                    <p className="font-semibold text-slate-800">{empresa.name}</p>
                    <p className="text-xs text-slate-500">{empresa.id.substring(0, 8)}...</p>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase transition-all ${empresa.active
                    ? 'bg-green-100/50 text-green-700 border border-green-200'
                    : 'bg-red-100/50 text-red-700 border border-red-200'
                    }`}>
                    {empresa.active ? (
                      <><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> ATIVA</>
                    ) : (
                      <><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> BLOQUEADA</>
                    )}
                  </span>
                </td>

                {/* Faturamento */}
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 text-slate-900 font-bold text-sm">
                      <span className="text-[10px] text-slate-400 font-medium">SET:</span>
                      R$ {empresa.setup_fee?.toFixed(2) || '0.00'}
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600 font-black text-xs">
                      <span className="text-[9px] text-emerald-400 font-medium tracking-tighter">MES:</span>
                      R$ {empresa.monthly_fee?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </td>

                {/* WhatsApp */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${empresa.whatsapp_status === 'connected' ? 'bg-green-500 ring-4 ring-green-500/10' : 'bg-slate-300'}`}></div>
                    <span className={`text-[10px] font-black tracking-widest ${empresa.whatsapp_status === 'connected' ? 'text-green-700' : 'text-slate-500'
                      }`}>
                      {empresa.whatsapp_status === 'connected' ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </td>

                {/* Data Criação */}
                <td className="px-6 py-4 text-sm text-slate-600">
                  {formatarData(empresa.created_at)}
                </td>

                {/* Ações */}
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {/* VER DETALHES */}
                    <button
                      onClick={() => handleVerDetalhes(empresa)}
                      className="p-2 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye size={18} />
                    </button>

                    {/* BLOQUEAR/DESBLOQUEAR */}
                    <button
                      onClick={() => handleToggleBloqueio(empresa.id, empresa.active)}
                      className={`p-2 rounded transition-colors ${empresa.active
                        ? 'hover:bg-yellow-100 text-yellow-600'
                        : 'hover:bg-green-100 text-green-600'
                        }`}
                      title={empresa.active ? 'Bloquear' : 'Desbloquear'}
                    >
                      {empresa.active ? <Lock size={18} /> : <Unlock size={18} />}
                    </button>

                    {/* DELETAR */}
                    <button
                      onClick={() => handleDeletarEmpresa(empresa.id, empresa.name)}
                      className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
                      title="Deletar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {empresas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">Nenhuma empresa cadastrada</p>
          </div>
        )}
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