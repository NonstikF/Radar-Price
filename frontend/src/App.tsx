import { useState } from 'react';
import { InvoiceUploader } from './components/InvoiceUploader';
import { ManualEntry } from './components/ManualEntry';
import { PriceChecker } from './components/PriceChecker';
import { Dashboard } from './components/dashboard'; // <--- IMPORTANTE
import { Logo } from './components/Logo';
import { LayoutGrid, FileText, Search, PlusCircle } from 'lucide-react';

function App() {
  // Estado para controlar qué pantalla se ve: 'dashboard', 'upload', 'search', 'manual'
  const [currentView, setCurrentView] = useState('dashboard');

  // Estado compartido de productos (para que el Dashboard sepa los números)
  const [products, setProducts] = useState<any[]>([]);

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900">

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm/50 backdrop-blur-xl bg-white/90">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

          {/* Logo con clic para volver al inicio */}
          <div className="cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <Logo variant="full" />
          </div>

          {/* Menú de Navegación (Escritorio) */}
          <nav className="hidden md:flex gap-1">
            <NavButton
              active={currentView === 'dashboard'}
              onClick={() => setCurrentView('dashboard')}
              icon={<LayoutGrid className="w-4 h-4" />}
              label="Panel"
            />
            <NavButton
              active={currentView === 'upload'}
              onClick={() => setCurrentView('upload')}
              icon={<FileText className="w-4 h-4" />}
              label="Cargar XML"
            />
            <NavButton
              active={currentView === 'search'}
              onClick={() => setCurrentView('search')}
              icon={<Search className="w-4 h-4" />}
              label="Buscador"
            />
            <NavButton
              active={currentView === 'manual'}
              onClick={() => setCurrentView('manual')}
              icon={<PlusCircle className="w-4 h-4" />}
              label="Manual"
            />
          </nav>
        </div>
      </header>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="animate-fade-in">
        {currentView === 'dashboard' && (
          <Dashboard products={products} onNavigate={setCurrentView} />
        )}

        {currentView === 'upload' && (
          <InvoiceUploader products={products} setProducts={setProducts} />
        )}

        {currentView === 'search' && (
          <PriceChecker />
        )}

        {currentView === 'manual' && (
          <ManualEntry />
        )}
      </main>

      {/* --- MENÚ FLOTANTE MÓVIL (Bottom Bar) --- */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 bg-gray-900/90 backdrop-blur-lg text-white p-2 rounded-2xl flex justify-around items-center shadow-2xl z-50 border border-white/10">
        <MobileNavBtn active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={<LayoutGrid className="w-5 h-5" />} />
        <MobileNavBtn active={currentView === 'upload'} onClick={() => setCurrentView('upload')} icon={<FileText className="w-5 h-5" />} />
        <div className="w-px h-8 bg-white/20"></div> {/* Separador */}
        <MobileNavBtn active={currentView === 'search'} onClick={() => setCurrentView('search')} icon={<Search className="w-5 h-5" />} />
        <MobileNavBtn active={currentView === 'manual'} onClick={() => setCurrentView('manual')} icon={<PlusCircle className="w-5 h-5" />} />
      </div>

    </div>
  );
}

// Componentes auxiliares para botones (para no ensuciar el código principal)
function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      {icon}
      {label}
    </button>
  )
}

function MobileNavBtn({ active, onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-gray-400 hover:text-white'}`}
    >
      {icon}
    </button>
  )
}

export default App;