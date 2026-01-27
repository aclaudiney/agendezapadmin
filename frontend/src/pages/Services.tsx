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
    descricao: '',
    preco: '',
    duracao_minutos: '30',
  });

  useEffect(() => {
    fetchServicos();
  }, []);

  const fetchServicos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('servicos').select('*');
      if (!error) setServicos(data || []);
    } catch (error) {
      setErro('Erro ao carregar serviços');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.nome || !formData.preco || !formData.duracao_minutos) {
      setErro('Preencha nome, preço e duração');
      return;
    }

    try {
      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('servicos')
          .update(formData)
          .eq('id', editingId);

        if (error) {
          setErro('Erro ao atualizar serviço');
          return;
        }
      } else {
        // Criar novo
        const { error } = await supabase.from('servicos').insert([formData]);

        if (error) {
          setErro('Erro ao criar serviço');
          return;
        }
      }

      setFormData({ nome: '', descricao: '', preco: '', duracao_minutos: '30' });
      setEditingId(null);
      setShowModal(false);
      fetchServicos();
    } catch (error) {
      setErro('Erro ao salvar serviço');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este serviço?')) return;

    try {
      const { error } = await supabase.from('servicos').delete().eq('id', id);

      if (error) {
        setErro('Erro ao deletar serviço');
        return;
      }

      fetchServicos();
    } catch (error) {
      setErro('Erro ao deletar');
      console.error(error);
    }
  };

  const handleEdit = (servico: any) => {
    setFormData({
      nome: servico.nome,
      descricao: servico.descricao || '',
      preco: servico.preco || '',
      duracao_minutos: servico.duracao_minutos || '30',
    });
    setEditingId(servico.id);
    setShowModal(true);
  };

  const openNewModal = () => {
    setFormData({ nome: '', descricao: '', preco: '', duracao_minutos: '30' });
    setEditingId(null);
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando...</p></div>;
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servicos.map(servico => (
          <div key={servico.id} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-slate-800">{servico.nome}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(servico)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(servico.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">{servico.descricao || 'Sem descrição'}</p>
            
            <div className="space-y-2 mb-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Preço:</span>
                <span className="text-2xl font-bold text-indigo-600">R$ {parseFloat(servico.preco).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Clock size={16} /> Duração:
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {servico.duracao_minutos} min
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {servicos.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Nenhum serviço cadastrado</p>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mx-auto"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Serviço</label>
                <input 
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: Corte de Cabelo"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descrição</label>
                <textarea 
                  value={formData.descricao}
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                  placeholder="Descreva o serviço..."
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Preço (R$)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData({...formData, preco: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Duração (minutos)</label>
                <input 
                  type="number"
                  value={formData.duracao_minutos}
                  onChange={(e) => setFormData({...formData, duracao_minutos: e.target.value})}
                  placeholder="30"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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