import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Plus, Trash2, Edit2, X, AlertCircle, Phone, Calendar } from 'lucide-react';

const Clients: React.FC = () => {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [erro, setErro] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    data_nascimento: '',
    ativo: true,
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  // ✅ BUSCAR APENAS CLIENTES ATIVOS
  const fetchClientes = async () => {
    try {
      setLoading(true);
      setErro('');

      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando clientes ativos para company_id:', companyId);

      const { data, error } = await supabase
        .from('clientes')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('ativo', true) // ✅ APENAS ATIVOS
        .order('nome', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar clientes:', error);
        setErro('Erro ao carregar clientes');
        setLoading(false);
        return;
      }

      console.log('✅ Clientes carregados:', data?.length || 0);
      setClientes(data || []);
      setErro('');
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!formData.nome.trim() || !formData.telefone.trim()) {
      setErro('Preencha nome e telefone');
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
          .from('clientes')
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            data_nascimento: formData.data_nascimento || null,
            ativo: formData.ativo,
          })
          .eq('id', editingId)
          .eq('company_id', companyId);

        if (error) {
          console.error('❌ Erro ao atualizar:', error);
          setErro('Erro ao atualizar cliente');
          return;
        }

        console.log('✅ Cliente atualizado');
      } else {
        // ✅ CRIAR NOVO
        const { error } = await supabase
          .from('clientes')
          .insert([{
            company_id: companyId,
            nome: formData.nome,
            telefone: formData.telefone,
            data_nascimento: formData.data_nascimento || null,
            ativo: true, // ✅ SEMPRE CRIA ATIVO
          }]);

        if (error) {
          console.error('❌ Erro ao criar:', error);
          setErro('Erro ao criar cliente');
          return;
        }

        console.log('✅ Cliente criado');
      }

      setFormData({ nome: '', telefone: '', data_nascimento: '', ativo: true });
      setEditingId(null);
      setShowModal(false);
      setErro('');
      await fetchClientes();
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao salvar cliente');
    }
  };

  // ✅ SOFT DELETE - DESATIVAR EM VEZ DE DELETAR
  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja desativar este cliente? (Será ocultado, mas o histórico será mantido)')) return;

    try {
      console.log('🔒 Desativando cliente:', id);

      const companyId = localStorage.getItem('companyId');
      
      if (!companyId) {
        setErro('Company ID não encontrado');
        return;
      }

      // ✅ DESATIVAR EM VEZ DE DELETAR (SOFT DELETE)
      const { error } = await supabase
        .from('clientes')
        .update({ ativo: false })
        .eq('id', id)
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ Erro ao desativar:', error);
        setErro('Erro ao desativar cliente');
        return;
      }

      console.log('✅ Cliente desativado com sucesso!');
      setErro('');
      
      // ✅ REMOVER DO ESTADO LOCAL IMEDIATAMENTE
      setClientes(clientes.filter(c => c.id !== id));
      
      // ✅ DEPOIS RECARREGAR DO BANCO
      setTimeout(() => {
        fetchClientes();
      }, 500);
      
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      setErro('Erro ao desativar');
    }
  };

  const handleEdit = (cliente: any) => {
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
      data_nascimento: cliente.data_nascimento || '',
      ativo: cliente.ativo ?? true,
    });
    setEditingId(cliente.id);
    setShowModal(true);
  };

  const openNewModal = () => {
    setFormData({ nome: '', telefone: '', data_nascimento: '', ativo: true });
    setEditingId(null);
    setShowModal(true);
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone.includes(searchTerm)
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96"><p className="text-slate-500">Carregando clientes...</p></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gerenciamento de Clientes</h2>
          <p className="text-slate-500">Adicione, edite ou remova clientes da sua base de dados.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Cliente
        </button>
      </header>

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {/* Barra de Busca */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientesFiltrados.map(cliente => (
          <div key={cliente.id} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800">{cliente.nome}</h3>
                <span className={`text-xs font-bold mt-1 inline-block px-2 py-1 rounded ${
                  cliente.ativo 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {cliente.ativo ? '✅ Ativo' : '❌ Inativo'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(cliente)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(cliente.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Desativar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                <p className="text-sm text-slate-700">{cliente.telefone}</p>
              </div>
              {cliente.data_nascimento && (
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <p className="text-sm text-slate-700">
                    {new Date(cliente.data_nascimento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {clientesFiltrados.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">
            {searchTerm ? 'Nenhum cliente encontrado com esse termo' : 'Nenhum cliente ativo cadastrado'}
          </p>
          {!searchTerm && (
            <button 
              onClick={openNewModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg mx-auto hover:bg-indigo-700"
            >
              <Plus size={18} />
              Adicionar Primeiro Cliente
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-800">
                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
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
                  placeholder="Ex: Maria Silva"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Telefone *</label>
                <input 
                  type="tel"
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Data de Nascimento</label>
                <input 
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
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
                  <span className="text-sm font-medium text-slate-700">Cliente Ativo</span>
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

export default Clients;