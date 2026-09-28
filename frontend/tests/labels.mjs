// Run from frontend: node --test tests/labels.mjs
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());
const { ProductLabel } = await server.ssrLoadModule('/src/components/labels/ProductLabel.tsx');
const product = { id: 1, name: 'Storage box', alias: 'Warehouse title', selling_price: 187 };
const settings = {
    size: '2x1', showName: true, showPrice: true, boldPrice: true,
    nameSource: 'alias_if_available', companyName: '',
};
const render = (overrides, productOverrides) => renderToStaticMarkup(
    React.createElement(ProductLabel, {
        product: { ...product, ...productOverrides },
        settings: { ...settings, ...overrides },
    }),
);

test('title-only labels include the alias and omit the price and currency', () => {
    const html = render({ showPrice: false });
    assert.match(html, /Warehouse title/);
    assert.doesNotMatch(html, /187|\$/);
    assert.doesNotMatch(html, /border-t-2/);
});

test('price-only labels omit the product title', () => {
    const html = render({ showName: false });
    assert.match(html, /187/);
    assert.match(html, /\$/);
    assert.doesNotMatch(html, /Warehouse title|Storage box/);
});

test('combined labels preserve the title and price', () => {
    const html = render({});
    assert.match(html, /Warehouse title/);
    assert.match(html, /187/);
});

test('name source and custom paper size survive content selection', () => {
    const html = render({
        showPrice: false, nameSource: 'always_name',
        size: 'custom', customWidth: '60mm', customHeight: '30mm',
    });
    assert.match(html, /Storage box/);
    assert.doesNotMatch(html, /Warehouse title/);
    assert.match(html, /size: 60mm 30mm/);
    assert.match(html, /width:60mm;height:30mm/);
});

test('A4 sheets ask for the whole page and drop the label dimensions', () => {
    const html = render({ size: 'a4' });
    assert.match(html, /size: A4 portrait/);
    assert.match(html, /width:210mm;height:297mm/);
    assert.doesNotMatch(html, /size: 2in 1in/);
});

test('landscape A4 swaps the sheet sides and asks the printer to turn the page', () => {
    const html = render({ size: 'a4-landscape' });
    assert.match(html, /size: A4 landscape/);
    assert.match(html, /width:297mm;height:210mm/);
    assert.doesNotMatch(html, /portrait/);

    // El alto útil ahora es el lado corto: 210mm menos el margen.
    const heights = [...html.matchAll(/height:([\d.]+)mm/g)].map(m => Number(m[1]));
    const [, price, name] = heights;
    assert.equal(Math.round(price + 6 + name), 210 - 20);
});

test('A4 sheets print the date and time only when asked and a print time exists', () => {
    const printedAt = new Date(2026, 8, 27, 14, 35).toISOString();
    const stamped = render({ size: 'a4', showDate: true, printedAt });
    assert.match(stamped, /27 sep 2026, 14:35/);
    // En el margen inferior derecho, chica y en negritas.
    assert.match(stamped, /"bottom:5mm;right:10mm;font-size:3.6mm" class="[^"]*font-bold/);

    assert.doesNotMatch(render({ size: 'a4', showDate: false, printedAt }), /14:35/);
    // Sin hora de impresión no hay fecha, aunque el ajuste viejo diga que sí.
    assert.doesNotMatch(render({ size: 'a4', showDate: true }), /font-size:3.6mm/);
});

test('the date takes no space from the price and name', () => {
    const printedAt = new Date(2026, 8, 27, 14, 35).toISOString();
    const heights = html => [...html.matchAll(/height:([\d.]+)mm/g)].map(m => Number(m[1]));
    assert.deepEqual(
        heights(render({ size: 'a4', showDate: true, printedAt })),
        heights(render({ size: 'a4', showDate: false })),
    );
});

test('the date never lands on a small label', () => {
    const printedAt = new Date(2026, 8, 27, 14, 35).toISOString();
    assert.doesNotMatch(render({ showDate: true, printedAt }), /14:35/);
});

test('A4 content scales through a viewBox instead of fixed type sizes', () => {
    const html = render({ size: 'a4' });
    // El precio y el título salen como SVG: es lo que los deja llenar la hoja.
    assert.match(html, /viewBox=/);
    assert.match(html, /\$187/);
    assert.match(html, /WAREHOUSE/);
    assert.doesNotMatch(html, /text-\[5rem\]|text-\[4rem\]/);
});

test('A4 blocks divide the printable height between what was asked for', () => {
    const heights = html => [...html.matchAll(/height:([\d.]+)mm/g)].map(m => Number(m[1]));
    const padding = 10 * 2;
    const gap = 6;

    // Solo el precio: se lleva todo el alto útil.
    const [sheet, priceOnly] = heights(render({ size: 'a4', showName: false }));
    assert.equal(sheet, 297);
    assert.equal(priceOnly, 297 - padding);

    // Precio y título: reparten ese mismo alto, con una separación entre ambos.
    const [, price, name] = heights(render({ size: 'a4' }));
    assert.ok(price > name, 'el precio manda sobre el título');
    assert.equal(Math.round(price + gap + name), 297 - padding);
});

test('A4 titles are split across lines without losing or reordering words', () => {
    const lines = html => [...html.matchAll(/>([^<>]+)<\/text>/g)].map(m => m[1]);

    const short = lines(render({ size: 'a4', showPrice: false }));
    assert.equal(short.join(' '), 'WAREHOUSE TITLE');

    const long = lines(render({
        size: 'a4', showPrice: false, nameSource: 'always_name',
    }, { name: 'Maceta de rattan redonda color chocolate premium para exterior' }));
    assert.equal(long.join(' '), 'MACETA DE RATTAN REDONDA COLOR CHOCOLATE PREMIUM PARA EXTERIOR');
    // Repartirlo agranda la letra: en un solo renglón tendría que encogerse
    // hasta caber en los 190mm de ancho útil.
    assert.ok(long.length > short.length, 'un título largo ocupa más renglones');
});

test('A4 line widths stay inside the printable width', () => {
    // textLength fija el ancho de cada renglón dentro del viewBox, así que
    // ninguno puede pasarse del recuadro que el viewBox declara.
    const html = render({ size: 'a4', showPrice: false, nameSource: 'always_name' },
        { name: 'Maceta de rattan redonda color chocolate premium para exterior' });
    const boxWidth = Number(html.match(/viewBox="0 0 ([\d.]+)/)[1]);
    const widths = [...html.matchAll(/textLength="([\d.]+)"/g)].map(m => Number(m[1]));
    assert.ok(widths.length > 0);
    for (const width of widths) assert.ok(width <= boxWidth, `${width} > ${boxWidth}`);
});

test('individual and batch print entry points render without opening a dialog', async () => {
    const { ItemPrintButton } = await server.ssrLoadModule('/src/components/labels/ItemPrintButton.tsx');
    const { BatchPrintButton } = await server.ssrLoadModule('/src/components/labels/BatchPrintButton.tsx');
    const item = renderToStaticMarkup(React.createElement(ItemPrintButton, { product }));
    const batch = renderToStaticMarkup(React.createElement(BatchPrintButton, {
        products: [product, { ...product, id: 2, alias: 'Second box' }],
    }));
    assert.match(item, /Imprimir etiqueta/);
    assert.match(batch, /Warehouse title/);
    assert.match(batch, /Second box/);
    assert.doesNotMatch(item + batch, /<dialog/);
});
