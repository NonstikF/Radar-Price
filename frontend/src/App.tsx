import { useState, useEffect } from 'react';
import axios from 'axios';
import { InvoiceUploader } from './components/InvoiceUploader';
import { ManualEntry } from './components/ManualEntry';
import { PriceChecker } from './components/PriceChecker';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { Login } from './components/UserLogin';
import { Logo } from './components/Logo';
import { LayoutGrid, FileText, Search, PlusCircle, Moon, Sun, Users, LogOut } from 'lucide-react';
import { API_URL } from './config';

function App() {
  // Estado inicial
  const [currentView, setCurrentView] = useState('search');
  const [products, setProducts] = useState<any[]>([]);
  const [filterMissing, setFilterMissing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Guardamos usuario completo
  const [user, setUser] = useState<{ username: string, role: string, permissions: string[] } | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark';
    return false;
  });

  // --- 🔒 FUNCIÓN DE SEGURIDAD ESTRICTA ---
  const canAccess = (viewName: string) => {
    if (!user) return false;

    // 1. Admin Supremo: Ve todo
    if (user.role === 'admin') return true;

    // 2. Usuario Mortal: Revisar lista de permisos
    // Nos aseguramos de que permissions sea un array real
    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
    return userPerms.includes(viewName);
  };

  useEffect(() => {
    axios.defaults.baseURL = API_URL;
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log("🔓 Usuario recuperado de memoria:", parsedUser); // DEBUG

        setIsAuthenticated(true);
        setUser(parsedUser);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // REDIRECCIÓN DE SEGURIDAD AL RECARGAR
        // Si estoy en Dashboard pero NO soy admin y NO tengo permiso de dashboard...
        if (parsedUser.role !== 'admin' && !parsedUser.permissions?.includes('dashboard')) {
          console.log("🚫 Redirigiendo a Buscador por falta de permisos");
          setCurrentView('search');
        } else if (parsedUser.role === 'admin') {
          // Si soy admin, por defecto al Dashboard
          if (currentView === 'search') setCurrentView('dashboard');
        }

      } catch (e) {
        console.error("Error al leer usuario guardado", e);
        handleLogout(); // Si hay error en los datos, cerramos sesión por seguridad
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
    console.log("✅ Login Exitoso. Datos recibidos:", userData); // DEBUG

    localStorage.setItem('token', userData.token);
    // Guardamos el objeto completo que viene del Backend (username, role, permissions)
    localStorage.setItem('user', JSON.stringify(userData));

    axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    setIsAuthenticated(true);
    setUser(userData);

    // REDIRECCIÓN INICIAL
    if (userData.role === 'admin' || userData.permissions?.includes('dashboard')) {
      setCurrentView('dashboard');
    } else {
      // Si no tiene dashboard, lo mandamos directo al buscador
      setCurrentView('search');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
    setCurrentView('search');
  };

  const handleNavigate = (view: string, enableFilter: boolean = false) => {
    setCurrentView(view);
    setFilterMissing(enableFilter);
  };

  if (!isAuthenticated) return <div className={darkMode ? 'dark' : ''}><Login onLoginSuccess={handleLoginSuccess} /></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* HEADER */}
      <header className="bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => handleNavigate('search')}>
            <Logo variant="full" />
          </div>

          <div className="flex items-center gap-4">

            {/* --- MENÚ DE NAVEGACIÓN (Solo botones permitidos) --- */}
            <nav className="hidden md:flex gap-1">

              {canAccess('dashboard') && (
                <NavButton active={currentView === 'dashboard'} onClick={() => handleNavigate('dashboard')} icon={<LayoutGrid className="w-4 h-4" />} label="Panel" />
              )}

              {canAccess('upload') && (
                <NavButton active={currentView === 'upload'} onClick={() => handleNavigate('upload')} icon={<FileText className="w-4 h-4" />} label="Cargar XML" />
              )}

              {canAccess('search') && (
                <NavButton active={currentView === 'search'} onClick={() => handleNavigate('search')} icon={<Search className="w-4 h-4" />} label="Buscador" />
              )}

              {canAccess('manual') && (
                <NavButton active={currentView === 'manual'} onClick={() => handleNavigate('manual')} icon={<PlusCircle className="w-4 h-4" />} label="Manual" />
              )}

              {/* Usuarios: ESTRICTAMENTE SOLO PARA ROL ADMIN */}
              {user?.role === 'admin' && (
                <NavButton active={currentView === 'admin'} onClick={() => handleNavigate('admin')} icon={<Users className="w-4 h-4" />} label="Usuarios" />
              )}
            </nav>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
              <span className="hidden md:block text-sm font-bold text-gray-500 mr-2 capitalize">{user?.username}</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                title="Cambiar tema"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={handleLogout} className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-500"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      {/* --- CONTENIDO PRINCIPAL (Protegido) --- */}
      <main className="animate-fade-in">
        {currentView === 'dashboard' && canAccess('dashboard') && <Dashboard onNavigate={handleNavigate} />}
        {currentView === 'upload' && canAccess('upload') && <InvoiceUploader products={products} setProducts={setProducts} />}
        {currentView === 'search' && canAccess('search') && <PriceChecker initialFilter={filterMissing} onClearFilter={() => setFilterMissing(false)} />}
        {currentView === 'manual' && canAccess('manual') && <ManualEntry />}

        {/* Solo mostramos AdminUsers si el rol es 'admin' real */}
        {currentView === 'admin' && user?.role === 'admin' && <AdminUsers />}
      </main>

      {/* --- MENÚ MÓVIL (También protegido) --- */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 dark:bg-gray-800/90 text-white p-2 rounded-2xl flex justify-around shadow-2xl z-50 overflow-x-auto border border-white/10 backdrop-blur-md">
        {canAccess('dashboard') && <MobileNavBtn onClick={() => handleNavigate('dashboard')} icon={<LayoutGrid className="w-5 h-5" />} active={currentView === 'dashboard'} />}
        {canAccess('upload') && <MobileNavBtn onClick={() => handleNavigate('upload')} icon={<FileText className="w-5 h-5" />} active={currentView === 'upload'} />}
        {canAccess('search') && <MobileNavBtn onClick={() => handleNavigate('search')} icon={<Search className="w-5 h-5" />} active={currentView === 'search'} />}
        {canAccess('manual') && <MobileNavBtn onClick={() => handleNavigate('manual')} icon={<PlusCircle className="w-5 h-5" />} active={currentView === 'manual'} />}
        {user?.role === 'admin' && <MobileNavBtn onClick={() => handleNavigate('admin')} icon={<Users className="w-5 h-5" />} active={currentView === 'admin'} />}
      </div>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white'}`}>
    {icon} {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon }: any) => (
  <button onClick={onClick} className={`p-3 rounded-xl transition-all ${active ? 'bg-blue-600 shadow-lg shadow-blue-500/50' : 'text-gray-400 hover:text-white'}`}>
    {icon}
  </button>
);

export default App;