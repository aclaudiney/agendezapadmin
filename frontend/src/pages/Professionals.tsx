import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, Edit2, X, AlertCircle, Users } from 'lucide-react';

const Professionals: React.FC = () => {
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [erro, setErro] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    especialidade: '',
    ativo: true,
  });

  useEffect(() => {
    fetchProfissionais();
  }, []);

  // ✅ BUSCAR APENAS PROFISSIONAIS ATIVOS
  const fetchProfissionais = async () => {
    try {
      setLoading(true);
      setErro('');

      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando profissionais ativos para company_id:', companyId);

      const { data, error } = await supabase
        .from('profissionais')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('ativo', true) // ✅ APENAS ATIVOS
        .order('nome', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar profissionais:', error);
        setErro('Erro ao carregar profissionais');
        setLoading(false);
        return;
      }

      console.log('✅ Profissionais carregados:', data?.length || 0);
      setProfissionais(data || []);
      setErro('');
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao carregar profissionais');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.nome.trim()) {
      setErro('Preencha o nome do profissional');
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
          .from('profissionais')
          .update({
            nome: formData.nome,
            telefone: formData.telefone || null,
            especialidade: formData.especialidade || null,
            ativo: formData.ativo,
          })
          .eq('id', editingId)
          .eq('company_id', companyId);

        if (error) {
          console.error('❌ Erro ao atualizar:', error);
          setErro('Erro ao atualizar profissional');
          return;
        }

        console.log('✅ Profissional atualizado');
      } else {
        // ✅ CRIAR NOVO
        const { error } = await supabase
          .from('profissionais')
          .insert([{
            company_id: companyId,
            nome: formData.nome,
            telefone: formData.telefone || null,
            especialidade: formData.especialidade || null,
            ativo: true, // ✅ SEMPRE CRIA ATIVO
          }]);

        if (error) {
          console.error('❌ Erro ao criar:', error);
          setErro('Erro ao criar profissional');
          return;
        }

        console.log('✅ Profissional criado');
      }

      setFormData({ nome: '', telefone: '', especialidade: '', ativo: true });
      setEditingId(null);
      setShowModal(false);
      setErro('');
      await fetchProfissionais();
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao salvar profissional');
    }
  };

  // ✅ SOFT DELETE - DESATIVAR EM VEZ DE DELETAR
  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja desativar este profissional? (Será ocultado, mas o histórico será mantido)')) return;

    try {
      console.log('🔒 Desativando profissional:', id);

      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // ✅ DESATIVAR EM VEZ DE DELETAR (SOFT DELETE)
      const { error } = await supabase
        .from('profissionais')
        .update({ ativo: false })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ Erro ao desativar:', error);
        setErro('Erro ao desativar profissional');
        return;
      }

      console.log('✅ Profissional desativado com sucesso!');
      setErro('');
      
      // ✅ REMOVER DO ESTADO LOCAL IMEDIATAMENTE
      setProfissionais(profissionais.filter(p => p.id !== id));
      
      // ✅ DEPOIS RECARREGAR DO BANCO
      setTimeout(() => {
        fetchProfissionais();
      }, 500);
      
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao desativar');
    }
  };

  const handleEdit = (profissional: any) => {
    setFormData({
      nome: profissional.nome,
      telefone: profissional.telefone || '',
      especialidade: profissional.especialidade || '',
      ativo: profissional.ativo ?? true,
    });
    setEditingId(profissional.id);
    setShowModal(true);
  };

  const openNewModal = () => {
    setFormData({ nome: '', telefone: '', especialidade: '', ativo: true });
    setEditingId(null);
    setShowModal(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando profissionais...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Profissionais</h2>
          <p className="text-slate-500">Adicione, edite ou remova profissionais da equipe.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Profissional
        </button>
      </header>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profissionais.map(profissional => (
          <div key={profissional.id} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={20} className="text-indigo-600" />
                  <h3 className="text-lg font-semibold text-slate-800">{profissional.nome}</h3>
                </div>
                <span className={`text-xs font-bold inline-block px-2 py-1 rounded ${
                  profissional.ativo 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {profissional.ativo ? '✅ Ativo' : '❌ Inativo'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(profissional)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(profissional.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Desativar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-slate-100">
              {profissional.especialidade && (
                <div>
                  <p className="text-xs text-slate-500">Especialidade:</p>
                  <p className="text-sm font-semibold text-slate-700">{profissional.especialidade}</p>
                </div>
              )}
              {profissional.telefone && (
                <div>
                  <p className="text-xs text-slate-500">Telefone:</p>
                  <p className="text-sm font-semibold text-slate-700">{profissional.telefone}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {profissionais.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Nenhum profissional ativo cadastrado</p>
          <button 
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mx-auto hover:bg-indigo-700"
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Nome *</label>
                <input 
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  placeholder="Ex: João Silva"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Especialidade</label>
                <input 
                  type="text"
                  value={formData.especialidade}
                  onChange={(e) => setFormData({...formData, especialidade: e.target.value})}
                  placeholder="Ex: Corte de Cabelo"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <span className="text-sm font-medium text-slate-700">Profissional Ativo</span>
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

export default Professionals;