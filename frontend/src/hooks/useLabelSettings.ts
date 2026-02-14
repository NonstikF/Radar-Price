import { useState, useEffect } from 'react';

// Exportamos los tipos para que los puedan usar otros componentes
export type LabelSize = '1.5x1' | '2x1' | '50x25mm';

export interface LabelSettings {
    size: LabelSize;
    showPrice: boolean;
    showSku: boolean;
    showDate: boolean;
    showName: boolean;
    boldPrice: boolean;
    fontSize: 'small' | 'normal' | 'large';

    // --- NUEVOS CAMPOS AGREGADOS PARA CORREGIR EL ERROR ---
    companyName?: string;      // Opcional: Nombre de la tienda en la etiqueta
    nameSource?: string;       // Opcional: 'product' o 'alias'
}

const DEFAULT_SETTINGS: LabelSettings = {
    size: '50x25mm',
    showPrice: true,
    showSku: true,
    showDate: true,
    showName: true,
    boldPrice: true,
    fontSize: 'normal',

    // Valores por defecto para los nuevos campos
    companyName: '',
    nameSource: 'product'
};

export function useLabelSettings() {
    const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const saved = localStorage.getItem('radar_label_settings_v2');
        if (saved) {
            try {
                // Usamos ...DEFAULT_SETTINGS primero para asegurar que si faltan campos nuevos, se rellenen
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Error cargando settings", e);
            }
        }
    }, []);

    const updateSettings = (newSettings: Partial<LabelSettings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('radar_label_settings_v2', JSON.stringify(updated));
    };

    return { settings, updateSettings };
}