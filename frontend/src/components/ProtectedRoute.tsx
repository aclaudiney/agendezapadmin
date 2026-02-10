import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  requiredRole?: 'super_admin' | 'empresa';
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requiredRole, 
  children 
}) => {
  // ✅ Verificar se está autenticado
  const autenticado = localStorage.getItem('autenticado') === 'true';
  
  if (!autenticado) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Se exigir role específica, verificar
  if (requiredRole) {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole !== requiredRole) {
      // Redirecionar pra página correta baseado no role
      if (userRole === 'super_admin') {
        return <Navigate to="/admin/dashboard" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  // ✅ Tudo ok, renderizar componente
  return <>{children}</>;
};

export default ProtectedRoute;