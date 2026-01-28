import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Plus, Eye, Trash2, Power, Loader, Lock, Unlock, X, AlertCircle, Copy, Check } from 'lucide-react';

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
  stats?: {
    total_clientes: number;
    total_profissionais: number;
    total_servicos: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCredenciaisModal, setShowCredenciaisModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [credenciais, setCredenciais] = useState<any>(null);
  const [copiado, setCopiado] = useState(false);

  // ✅ CARREGAR EMPRESAS AO ABRIR
  useEffect(() => {
    carregarEmpresas();
  }, []);

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
    } catch (error) {
      setErro('Erro ao deletar empresa');
      console.error(error);
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

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">Total de Empresas</p>
          <p className="text-4xl font-bold text-indigo-600 mt-2">{empresas.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">Ativas</p>
          <p className="text-4xl font-bold text-green-600 mt-2">{empresas.filter(e => e.active).length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">Bloqueadas</p>
          <p className="text-4xl font-bold text-red-600 mt-2">{empresas.filter(e => !e.active).length}</p>
        </div>
      </div>

      {/* TABELA DE EMPRESAS */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Nome</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">WhatsApp</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Criado em</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Ações</th>
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
                <td className="px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    empresa.active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {empresa.active ? '✅ Ativa' : '🔒 Bloqueada'}
                  </span>
                </td>

                {/* WhatsApp */}
                <td className="px-6 py-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    empresa.whatsapp_status === 'connected'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {empresa.whatsapp_status === 'connected' ? '📱 Conectado' : '⏳ Desconectado'}
                  </span>
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
                      className={`p-2 rounded transition-colors ${
                        empresa.active
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
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors text-white ${
                    selectedEmpresa.active
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
      
      const resposta = await adminService.criarEmpresa(nome, descricao || undefined);
      
      // ✅ MOSTRAR CREDENCIAIS
      if (resposta.credenciais) {
        onSuccess(resposta.credenciais);
      }
      
      setNome('');
      setDescricao('');
    } catch (error: any) {
      setErro('Erro ao criar empresa');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Nova Empresa</h2>

        {erro && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700 mb-4 flex items-start gap-3">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{erro}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nome da Empresa *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Barbearia X"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional"
              rows={3}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;