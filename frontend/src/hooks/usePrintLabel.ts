// src/hooks/usePrintLabel.ts
import { useReactToPrint } from 'react-to-print';

export function usePrintLabel(contentRef: any, documentTitle: string) {
    // Aquí centralizamos la lógica. Si mañana cambias de librería, solo tocas este archivo.
    const handlePrint = useReactToPrint({
        contentRef,
        documentTitle: documentTitle || 'Etiqueta',
        onAfterPrint: () => console.log("Impresión enviada con éxito"),
        onPrintError: (error) => console.error("Error al imprimir:", error),
    });

    return handlePrint;
}