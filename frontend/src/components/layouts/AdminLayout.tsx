import React, { useState } from 'react';
import AdminSidebar from '../AdminSidebar';

interface AdminLayoutProps {
    children: React.ReactNode;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activePage, onNavigate, onLogout }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleNavigate = (page: string) => {
        onNavigate(page);
        setIsSidebarOpen(false);
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans antialiased">
            {/* Sidebar Desktop */}
            <div className="hidden lg:flex">
                <AdminSidebar
                    activePage={activePage}
                    onNavigate={handleNavigate}
                    onLogout={onLogout}
                />
            </div>

            {/* Sidebar Mobile (Overlay) */}
            {isSidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-slate-900/50"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <div className="absolute left-0 top-0 w-72 h-full bg-slate-900">
                        <AdminSidebar
                            activePage={activePage}
                            onNavigate={handleNavigate}
                            onLogout={onLogout}
                        />
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
                {/* Topbar Mobile */}
                <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200">
                    <div className="flex items-center justify-between px-4 py-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium"
                        >
                            Menu
                        </button>
                        <div className="text-sm font-semibold text-slate-700">Admin</div>
                    </div>
                </div>

                <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-10">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
