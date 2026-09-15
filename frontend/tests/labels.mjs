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
const render = overrides => renderToStaticMarkup(
    React.createElement(ProductLabel, { product, settings: { ...settings, ...overrides } }),
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
