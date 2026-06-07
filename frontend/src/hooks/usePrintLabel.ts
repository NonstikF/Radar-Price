// src/hooks/usePrintLabel.ts
// Impresión de etiquetas vía iframe aislado.
//
// ¿Por qué no react-to-print? En Chrome Android no aislaba el contenido y
// terminaba imprimiendo toda la app. Además el <style> con @page de la
// etiqueta se filtraba al documento principal. Con un iframe propio:
//   - Se imprime SOLO la etiqueta (su innerHTML).
//   - El @page/tamaño de papel queda confinado al iframe.
//   - Copiamos los estilos del documento (Tailwind) para que se vea igual.
//   - No usa window.open => no lo bloquean los popups del móvil.

export function usePrintLabel(contentRef: any, documentTitle: string) {
    const handlePrint = () => {
        const node = contentRef?.current;
        if (!node) {
            console.error("usePrintLabel: contentRef vacío");
            return;
        }

        const html = node.innerHTML;

        // Copiar hojas de estilo del documento (Tailwind compilado, etc.)
        const headStyles = Array.from(
            document.querySelectorAll('style, link[rel="stylesheet"]')
        )
            .map((el) => el.outerHTML)
            .join("\n");

        // iframe oculto
        const iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);

        const win = iframe.contentWindow;
        const doc = win?.document;
        if (!win || !doc) {
            document.body.removeChild(iframe);
            return;
        }

        doc.open();
        doc.write(
            `<!DOCTYPE html><html><head><title>${documentTitle || "Etiqueta"}</title>${headStyles}</head><body>${html}</body></html>`
        );
        doc.close();

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            try {
                document.body.removeChild(iframe);
            } catch (e) {
                /* noop */
            }
        };

        win.onafterprint = cleanup;

        // Esperar a que el iframe renderice estilos/imágenes antes de imprimir
        setTimeout(() => {
            try {
                win.focus();
                win.print();
            } catch (e) {
                console.error("Error al imprimir:", e);
            }
            // Respaldo: limpiar aunque no dispare onafterprint (algunos móviles)
            setTimeout(cleanup, 2000);
        }, 400);
    };

    return handlePrint;
}
