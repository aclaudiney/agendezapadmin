import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, Edit2, X, AlertCircle, Clock } from 'lucide-react';

const Services: React.FC = () => {
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [erro, setErro] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    preco: '',
    duracao: '30',
    ativo: true,
  });

  useEffect(() => {
    fetchServicos();
  }, []);

  // ✅ BUSCAR APENAS SERVIÇOS ATIVOS
  const fetchServicos = async () => {
    try {
      setLoading(true);
      setErro('');
      const CACHE_TTL_MS = 120000;

      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando serviços ativos para company_id:', companyId);

      try {
        const cache = localStorage.getItem(`cache_servicos_${companyId}`);
        const parsed = cache ? JSON.parse(cache) : null;
        const now = Date.now();
        if (parsed && now - (parsed.ts || 0) < CACHE_TTL_MS) {
          setServicos(parsed.data || []);
        }
      } catch {}

      const { data, error } = await supabase
        .from('servicos')
        .select('id, nome, preco, duracao, ativo', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar serviços:', error);
        setErro('Erro ao carregar serviços');
        setLoading(false);
        return;
      }

      console.log('✅ Serviços carregados:', data?.length || 0);
      setServicos(data || []);
      try {
        localStorage.setItem(`cache_servicos_${companyId}`, JSON.stringify({ ts: Date.now(), data: data || [] }));
      } catch {}
      setErro('');
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.nome.trim() || !formData.preco || !formData.duracao) {
      setErro('Preencha nome, preço e duração');
      return;
    }

    try {
      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      if (editingId) {
        // ✅ ATUALIZAR
        const { error } = await supabase
          .from('servicos')
          .update({
            nome: formData.nome,
            preco: parseFloat(formData.preco),
            duracao: parseInt(formData.duracao),
            ativo: formData.ativo,
          })
          .eq('id', editingId)
          .eq('company_id', companyId);

        if (error) {
          console.error('❌ Erro ao atualizar:', error);
          setErro('Erro ao atualizar serviço');
          return;
        }

        console.log('✅ Serviço atualizado');
      } else {
        // ✅ CRIAR NOVO
        const { error } = await supabase
          .from('servicos')
          .insert([{
            company_id: companyId,
            nome: formData.nome,
            preco: parseFloat(formData.preco),
            duracao: parseInt(formData.duracao),
            ativo: true, // ✅ SEMPRE CRIA ATIVO
          }]);

        if (error) {
          console.error('❌ Erro ao criar:', error);
          setErro('Erro ao criar serviço');
          return;
        }

        console.log('✅ Serviço criado');
      }

      setFormData({ nome: '', preco: '', duracao: '30', ativo: true });
      setEditingId(null);
      setShowModal(false);
      setErro('');
      await fetchServicos();
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao salvar serviço');
    }
  };

  // ✅ SOFT DELETE - DESATIVAR EM VEZ DE DELETAR
  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja desativar este serviço? (Será ocultado, mas o histórico será mantido)')) return;

    try {
      console.log('🔒 Desativando serviço:', id);

      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // ✅ DESATIVAR EM VEZ DE DELETAR (SOFT DELETE)
      const { error } = await supabase
        .from('servicos')
        .update({ ativo: false })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ Erro ao desativar:', error);
        setErro('Erro ao desativar serviço');
        return;
      }

      console.log('✅ Serviço desativado com sucesso!');
      setErro('');
      
      // ✅ REMOVER DO ESTADO LOCAL IMEDIATAMENTE
      setServicos(servicos.filter(s => s.id !== id));
      
      // ✅ DEPOIS RECARREGAR DO BANCO
      setTimeout(() => {
        fetchServicos();
      }, 500);
      
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao desativar');
    }
  };

  const handleEdit = (servico: any) => {
    setFormData({
      nome: servico.nome,
      preco: servico.preco || '',
      duracao: servico.duracao || '30',
      ativo: servico.ativo ?? true,
    });
    setEditingId(servico.id);
    setShowModal(true);
  };

  const openNewModal = () => {
    setFormData({ nome: '', preco: '', duracao: '30', ativo: true });
    setEditingId(null);
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando serviços...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Serviços</h2>
          <p className="text-slate-500">Adicione, edite ou remova serviços do seu catálogo.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Serviço
        </button>
      </header>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servicos.map(servico => (
          <div key={servico.id} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800">{servico.nome}</h3>
                <span className={`text-xs font-bold mt-1 inline-block px-2 py-1 rounded ${
                  servico.ativo 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {servico.ativo ? '✅ Ativo' : '❌ Inativo'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(servico)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(servico.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Desativar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Preço:</span>
                <span className="text-2xl font-bold text-indigo-600">R$ {parseFloat(servico.preco).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Clock size={16} /> Duração:
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {servico.duracao} min
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {servicos.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Nenhum serviço ativo cadastrado</p>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mx-auto hover:bg-indigo-700"
          >
            <Plus size={18} />
            Adicionar Primeiro Serviço
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                {editingId ? 'Editar Serviço' : 'Novo Serviço'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            {erro && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{erro}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Serviço *</label>
                <input 
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: Corte de Cabelo"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Preço (R$) *</label>
                <input 
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData({...formData, preco: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Duração (minutos) *</label>
                <input 
                  type="number"
                  value={formData.duracao}
                  onChange={(e) => setFormData({...formData, duracao: e.target.value})}
                  placeholder="30"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input 
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">Serviço Ativo</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  {editingId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
