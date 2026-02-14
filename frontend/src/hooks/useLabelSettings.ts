import { useState, useEffect } from 'react';

// Definimos la "forma" que tendrán nuestros ajustes
export interface LabelSettings {
    size: '1.5x1' | '2x1' | '50x25mm';
    showPrice: boolean;
    showSku: boolean;
    showDate: boolean;
    showName: boolean; // Agregué este por si acaso quieres etiquetas minimalistas
    boldPrice: boolean;
    fontSize: 'small' | 'normal' | 'large';
}

const DEFAULT_SETTINGS: LabelSettings = {
    size: '50x25mm',
    showPrice: true,
    showSku: true,
    showDate: true,
    showName: true,
    boldPrice: true,
    fontSize: 'normal'
};

export function useLabelSettings() {
    const [settings, setSettings] = useState<LabelSettings>(DEFAULT_SETTINGS);

    // Cargar al inicio
    useEffect(() => {
        const saved = localStorage.getItem('radar_label_settings_v2'); // Usamos v2 para limpiar configuraciones viejas
        if (saved) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Error cargando settings", e);
            }
        }
    }, []);

    // Guardar cambios automáticamente
    const updateSettings = (newSettings: Partial<LabelSettings>) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('radar_label_settings_v2', JSON.stringify(updated));
    };

    return { settings, updateSettings };
}