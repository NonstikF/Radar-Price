import { useState } from 'react';
import { InvoiceUploader } from './components/InvoiceUploader';
import { PriceChecker } from './components/PriceChecker';
import { ManualEntry } from './components/ManualEntry'; // <--- IMPORTADO
import { UploadCloud, Search, AlertTriangle, ArrowLeft, Trash2, PlusSquare } from 'lucide-react'; // <--- ICONO NUEVO
import { Logo } from './components/Logo';

function App() {
  // Ahora el estado acepta 3 valores: 'upload', 'search', 'manual'
  const [activeTab, setActiveTab] = useState<'upload' | 'search' | 'manual'>('upload');

  // Estado compartido para la lista de productos (InvoiceUploader)
  const [products, setProducts] = useState<any[]>([]);

  // Estados para el Modal de "Salir sin guardar"
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingTab, setPendingTab] = useState<'upload' | 'search' | 'manual' | null>(null);

  // FUNCIÓN INTELIGENTE DE CAMBIO DE PESTAÑA
  const handleTabChange = (tab: 'upload' | 'search' | 'manual') => {
    // Si estamos en 'upload', hay productos cargados y nos queremos ir a otra pestaña...
    if (activeTab === 'upload' && tab !== 'upload' && products.length > 0) {
      setPendingTab(tab);
      setShowExitConfirm(true); // ¡Alto ahí!
    } else {
      setActiveTab(tab); // Pase usted
    }
  };

  const confirmExit = () => {
    setProducts([]); // Borramos la lista (limpieza)
    if (pendingTab) setActiveTab(pendingTab);
    setShowExitConfirm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

          {/* AQUÍ VA TU NUEVO LOGO */}
          <Logo variant="full" />

          {/* ... tus botones de navegación ... */}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 pb-24 md:pb-0">
        {activeTab === 'upload' && <InvoiceUploader products={products} setProducts={setProducts} />}
        {activeTab === 'search' && <PriceChecker />}
        {activeTab === 'manual' && <ManualEntry />}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR (3 BOTONES) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
        <div className="flex justify-around items-center max-w-lg mx-auto">

          <button
            onClick={() => handleTabChange('upload')}
            className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${activeTab === 'upload' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <UploadCloud className={`w-6 h-6 mb-1 ${activeTab === 'upload' ? 'fill-blue-100' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Cargar</span>
          </button>

          {/* BOTÓN NUEVO: AGREGAR MANUALMENTE */}
          <button
            onClick={() => handleTabChange('manual')}
            className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${activeTab === 'manual' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <PlusSquare className={`w-6 h-6 mb-1 ${activeTab === 'manual' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Agregar</span>
          </button>

          <button
            onClick={() => handleTabChange('search')}
            className={`flex flex-col items-center justify-center w-full py-3 transition-colors ${activeTab === 'search' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Search className={`w-6 h-6 mb-1 ${activeTab === 'search' ? 'stroke-[3px]' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Buscar</span>
          </button>

        </div>
      </div>

      {/* --- MODAL DE ADVERTENCIA AL SALIR --- */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[60] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <div className="bg-white p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 max-w-xs w-full">
            <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">¿Salir sin guardar?</h3>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Tienes una lista cargada. Si sales ahora, <b>perderás los datos</b> que no hayas guardado.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Cancelar (Quedarme)
              </button>
              <button
                onClick={confirmExit}
                className="w-full text-red-500 hover:bg-red-50 font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Sí, salir y limpiar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App;