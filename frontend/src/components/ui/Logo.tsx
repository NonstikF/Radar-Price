interface Props {
    variant?: 'full' | 'icon';
    className?: string;
}

// Logo de la marca en PNG (public/brand). El horizontal tiene una versión
// para fondo claro y otra para modo oscuro; el ícono sirve en ambos.
export function Logo({ variant = 'full', className = "" }: Props) {
    if (variant === 'icon') {
        return <img src="/brand/icon-192.png" alt="Radar Price" className={`h-10 w-10 ${className}`} />;
    }

    return (
        <span className={`inline-flex ${className}`}>
            <img src="/brand/logo-horizontal.png" alt="Radar Price, inteligencia de costos" width={198} height={40} className="h-10 w-auto dark:hidden" />
            <img src="/brand/logo-horizontal-dark.png" alt="Radar Price, inteligencia de costos" width={198} height={40} className="hidden h-10 w-auto dark:block" />
        </span>
    );
}
