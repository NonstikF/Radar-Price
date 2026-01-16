import { useState, useEffect } from 'react';
import axios from 'axios'; // <--- 1. IMPORTAR AXIOS
import { InvoiceUploader } from './components/InvoiceUploader';
import { ManualEntry } from './components/ManualEntry';
import { PriceChecker } from './components/PriceChecker';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { Login } from './components/UserLogin';
import { Logo } from './components/Logo';
import { LayoutGrid, FileText, Search, PlusCircle, Moon, Sun, Users, LogOut } from 'lucide-react';
import { API_URL } from './config'; // Asegúrate de importar tu URL base si la usas para configurar axios

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState<any[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);

  // Estado de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ username: string, role: string } | null>(null);

  // Modo Oscuro
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Verificar sesión al inicio (Y CONFIGURAR AXIOS)
  useEffect(() => {
    // 1. CONFIGURACIÓN GLOBAL DE URL BASE (Agrega esta línea)
    // Esto soluciona la advertencia y configura axios para siempre
    axios.defaults.baseURL = API_URL;

    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setIsAuthenticated(true);
      setUser(parsedUser);

      // 2. CONFIGURACIÓN GLOBAL DE TOKEN
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Redirección de seguridad
      if (parsedUser.role !== 'admin' && currentView === 'dashboard') {
        setCurrentView('search');
      }
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLoginSuccess = (userData: any) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify({ username: userData.username, role: userData.role }));

    // --- 3. CONFIGURACIÓN GLOBAL AL INICIAR SESIÓN ---
    // Inyectamos el token inmediatamente al loguearse
    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;

    setIsAuthenticated(true);
    setUser(userData);

    if (userData.role === 'admin') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('search');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // --- 4. LIMPIEZA AL CERRAR SESIÓN ---
    // Borramos el token de axios para evitar problemas de seguridad
    delete axios.defaults.headers.common['Authorization'];

    setIsAuthenticated(false);
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleNavigate = (view: string, enableFilter: boolean = false) => {
    setCurrentView(view);
    setFilterMissing(enableFilter);
  };

  if (!isAuthenticated) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* HEADER */}
      <header className="bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 shadow-sm/50 backdrop-blur-xl transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => user?.role === 'admin' ? handleNavigate('dashboard') : handleNavigate('search')}>
            <Logo variant="full" />
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden md:flex gap-1">

              {user?.role === 'admin' && (
                <NavButton active={currentView === 'dashboard'} onClick={() => handleNavigate('dashboard')} icon={<LayoutGrid className="w-4 h-4" />} label="Panel" />
              )}

              <NavButton active={currentView === 'upload'} onClick={() => handleNavigate('upload')} icon={<FileText className="w-4 h-4" />} label="Cargar XML" />
              <NavButton active={currentView === 'search'} onClick={() => handleNavigate('search')} icon={<Search className="w-4 h-4" />} label="Buscador" />

              {user?.role === 'admin' && (
                <NavButton active={currentView === 'manual'} onClick={() => handleNavigate('manual')} icon={<PlusCircle className="w-4 h-4" />} label="Manual" />
              )}

              {user?.role === 'admin' && (
                <NavButton active={currentView === 'admin'} onClick={() => handleNavigate('admin')} icon={<Users className="w-4 h-4" />} label="Usuarios" />
              )}
            </nav>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4 ml-2">
              <span className="hidden md:block text-sm font-bold text-gray-500 dark:text-gray-400 mr-2 capitalize">{user?.username}</span>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                title="Cambiar tema"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="animate-fade-in">

        {currentView === 'dashboard' && user?.role === 'admin' && (
          <Dashboard onNavigate={handleNavigate} />
        )}

        {currentView === 'upload' && (
          <InvoiceUploader products={products} setProducts={setProducts} />
        )}

        {currentView === 'search' && (
          <PriceChecker initialFilter={filterMissing} onClearFilter={() => setFilterMissing(false)} />
        )}

        {currentView === 'manual' && user?.role === 'admin' && (
          <ManualEntry />
        )}

        {currentView === 'admin' && user?.role === 'admin' && (
          <AdminUsers />
        )}
      </main>

      {/* MENÚ MÓVIL */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 dark:bg-gray-800/90 backdrop-blur-lg text-white p-2 rounded-2xl flex justify-around items-center shadow-2xl z-50 border border-white/10 overflow-x-auto">

        {user?.role === 'admin' && (
          <MobileNavBtn active={currentView === 'dashboard'} onClick={() => handleNavigate('dashboard')} icon={<LayoutGrid className="w-5 h-5" />} />
        )}

        <MobileNavBtn active={currentView === 'upload'} onClick={() => handleNavigate('upload')} icon={<FileText className="w-5 h-5" />} />
        <MobileNavBtn active={currentView === 'search'} onClick={() => handleNavigate('search')} icon={<Search className="w-5 h-5" />} />

        {user?.role === 'admin' && (
          <MobileNavBtn active={currentView === 'manual'} onClick={() => handleNavigate('manual')} icon={<PlusCircle className="w-5 h-5" />} />
        )}

        {user?.role === 'admin' && (
          <MobileNavBtn active={currentView === 'admin'} onClick={() => handleNavigate('admin')} icon={<Users className="w-5 h-5" />} />
        )}
      </div>

    </div>
  );
}

function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}>
      {icon} {label}
    </button>
  )
}

function MobileNavBtn({ active, onClick, icon }: any) {
  return (
    <button onClick={onClick} className={`p-3 rounded-xl transition-all flex-shrink-0 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-gray-400 hover:text-white'}`}>
      {icon}
    </button>
  )
}

export default App;