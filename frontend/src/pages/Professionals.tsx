import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, Edit2, X, AlertCircle } from 'lucide-react';

const Professionals: React.FC = () => {
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [erro, setErro] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    especialidade: '',
    telefone: '',
  });

  useEffect(() => {
    fetchProfissionais();
  }, []);

  const fetchProfissionais = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profissionais').select('*');
      if (!error) setProfissionais(data || []);
    } catch (error) {
      setErro('Erro ao carregar profissionais');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.nome) {
      setErro('Preencha o nome');
      return;
    }

    try {
      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from('profissionais')
          .update(formData)
          .eq('id', editingId);

        if (error) {
          setErro('Erro ao atualizar profissional');
          return;
        }
      } else {
        // Criar novo
        const { error } = await supabase.from('profissionais').insert([formData]);

        if (error) {
          setErro('Erro ao criar profissional');
          return;
        }
      }

      setFormData({ nome: '', especialidade: '', telefone: '' });
      setEditingId(null);
      setShowModal(false);
      fetchProfissionais();
    } catch (error) {
      setErro('Erro ao salvar profissional');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este profissional?')) return;

    try {
      const { error } = await supabase.from('profissionais').delete().eq('id', id);

      if (error) {
        setErro('Erro ao deletar profissional');
        return;
      }

      fetchProfissionais();
    } catch (error) {
      setErro('Erro ao deletar');
      console.error(error);
    }
  };

  const handleEdit = (profissional: any) => {
    setFormData({
      nome: profissional.nome,
      especialidade: profissional.especialidade || '',
      telefone: profissional.telefone || '',
    });
    setEditingId(profissional.id);
    setShowModal(true);
  };

  const openNewModal = () => {
    setFormData({ nome: '', especialidade: '', telefone: '' });
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
          <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Profissionais</h2>
          <p className="text-slate-500">Adicione, edite ou remova profissionais do seu salão.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Profissional
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profissionais.map(profissional => (
          <div key={profissional.id} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-slate-800">{profissional.nome}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(profissional)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(profissional.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              <strong>Especialidade:</strong> {profissional.especialidade || 'Não especificada'}
            </p>
            <p className="text-sm text-slate-600">
              <strong>Telefone:</strong> {profissional.telefone || 'Não informado'}
            </p>
          </div>
        ))}
      </div>

      {profissionais.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Nenhum profissional cadastrado</p>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mx-auto"
          >
            <Plus size={18} />
            Adicionar Primeiro Profissional
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                {editingId ? 'Editar Profissional' : 'Novo Profissional'}
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome Completo</label>
                <input 
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: Maria Silva"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Especialidade</label>
                <input 
                  type="text"
                  value={formData.especialidade}
                  onChange={(e) => setFormData({...formData, especialidade: e.target.value})}
                  placeholder="Ex: Cabeleireiro"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Telefone</label>
                <input 
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(11) 99999-9999"
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

export default Professionals;