import { useState, useEffect } from 'react';

// Definimos los tipos permitidos, incluyendo 'custom'
export type LabelSize = '1.5x1' | '2x1' | '50x25mm' | 'custom';

export interface LabelSettings {
    size: LabelSize;
    showPrice: boolean;
    showSku: boolean;
    showDate: boolean;
    showName: boolean;
    boldPrice: boolean;
    fontSize: 'small' | 'normal' | 'large';
    companyName?: string;
    nameSource?: string;

    // CAMPOS NUEVOS PARA MEDIDA PERSONALIZADA
    customWidth?: string;
    customHeight?: string;
}

const DEFAULT_SETTINGS: LabelSettings = {
    size: '50x25mm',
    showPrice: true,
    showSku: true,
    showDate: true,
    showName: true,
    boldPrice: true,
    fontSize: 'normal',
    companyName: '',
    nameSource: 'alias_if_available',

    // Valores por defecto
    customWidth: '2in',
    customHeight: '1in'
};

export function useLabelSettings() {
    // Usamos una clave nueva (v3) para evitar conflictos con configuraciones viejas
    const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        const saved = localStorage.getItem('radar_label_settings_v3');
        if (saved) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Error cargando settings", e);
            }
        }
    }, []);

    const updateSettings = (newSettings: Partial<LabelSettings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('radar_label_settings_v3', JSON.stringify(updated));
    };

    return { settings, updateSettings };
}