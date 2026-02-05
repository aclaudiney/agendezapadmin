import React from 'react';
import AdminSidebar from '../AdminSidebar';

interface AdminLayoutProps {
    children: React.ReactNode;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activePage, onNavigate, onLogout }) => {
    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased">
            <AdminSidebar
                activePage={activePage}
                onNavigate={onNavigate}
                onLogout={onLogout}
            />
            <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
                <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-10">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
