import { Radio, DollarSign, ScanLine } from 'lucide-react';

interface Props {
    variant?: 'minimal' | 'full' | 'scanner';
    className?: string;
}

export function Logo({ variant = 'full', className = "" }: Props) {

    // OPCIÓN 1: El Clásico (Ondas de Radar + Dinero)
    if (variant === 'full') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="relative flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white">
                    {/* El icono de Radio simula el Radar */}
                    <Radio className="w-6 h-6 absolute opacity-50" />
                    <DollarSign className="w-5 h-5 font-bold z-10 relative" />
                </div>
                <div className="flex flex-col">
                    {/* 👇 AQUÍ ESTÁ EL CAMBIO PRINCIPAL: dark:text-white */}
                    <span className="text-xl font-black text-gray-900 dark:text-white leading-none tracking-tight transition-colors">
                        RADAR
                        {/* 👇 Ajusté el azul para que brille más en modo oscuro */}
                        <span className="text-blue-600 dark:text-blue-400">PRICE</span>
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold tracking-widest uppercase transition-colors">
                        Inteligencia de Costos
                    </span>
                </div>
            </div>
        );
    }

    // OPCIÓN 2: El Escáner
    if (variant === 'scanner') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                {/* Ajuste de fondo para dark mode */}
                <div className="bg-gray-900 dark:bg-gray-800 p-2 rounded-lg text-green-400 border border-green-500/30 transition-colors">
                    <ScanLine className="w-6 h-6" />
                </div>
                {/* 👇 CAMBIO: dark:text-white */}
                <span className="text-lg font-bold text-gray-800 dark:text-white tracking-tighter transition-colors">
                    Radar<span className="text-green-600 dark:text-green-400">Price</span>_
                </span>
            </div>
        );
    }

    // OPCIÓN 3: Minimalista (Solo ícono)
    return (
        <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg text-white">
            <Radio className="w-5 h-5" />
        </div>
    );
}