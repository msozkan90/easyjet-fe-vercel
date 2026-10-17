import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProductVariantFilterConfig, loadProductVariantOptions,
  normalizeProductIds, resetProductVariantFilters,
} from '../src/utils/productVariantFilters.mjs';

const columns = [
  { dataIndex: 'product_id', filter: { type: 'select' } },
  { dataIndex: 'size_name', filter: { type: 'select' } },
  { dataIndex: 'color_name', filter: { type: 'select' } },
  { dataIndex: 'status', filter: { type: 'select' } },
];
const config = getProductVariantFilterConfig(columns);

test('changing the product clears both variant filters and preserves other filters', () => {
  const previous = { product_id: 'shirt', size_name: 'M', color_name: 'Red', status: 'active' };
  const next = resetProductVariantFilters(previous, { ...previous, product_id: 'doormat' }, config);
  assert.deepEqual(next, { product_id: 'doormat', size_name: undefined, color_name: undefined, status: 'active' });
  assert.equal(previous.size_name, 'M');
});

test('clearing the product clears children; changing a variant keeps its sibling', () => {
  const previous = { product_id: 'doormat', size_name: 'Large', color_name: 'Brown' };
  assert.deepEqual(resetProductVariantFilters(previous, { ...previous, product_id: undefined }, config), {
    product_id: undefined, size_name: undefined, color_name: undefined,
  });
  const next = { ...previous, size_name: 'Small' };
  assert.equal(resetProductVariantFilters(previous, next, config), next);
});

test('multi-product selections reset dependent multi-selects only when the product set changes', () => {
  const multiConfig = { parent: 'product', children: [{ key: 'size', multiple: true }, { key: 'color', multiple: true }] };
  const previous = { product: ['a', 'b'], size: ['size-a'], color: ['brown'] };
  const reordered = { ...previous, product: ['b', 'a', 'a'] };
  assert.equal(resetProductVariantFilters(previous, reordered, multiConfig), reordered);
  assert.deepEqual(resetProductVariantFilters(previous, { ...previous, product: ['a'] }, multiConfig), {
    product: ['a'], size: [], color: [],
  });
  assert.deepEqual(normalizeProductIds(['b', 'a', 'b', null]), ['a', 'b']);
});

test('only select filters with a product parent participate; row editors and unrelated tables are unchanged', () => {
  assert.equal(getProductVariantFilterConfig([{ dataIndex: 'size_id', filter: { type: 'select' } }]), null);
  assert.equal(getProductVariantFilterConfig([{ dataIndex: 'product' }, { dataIndex: 'size' }]), null);
  assert.equal(getProductVariantFilterConfig([{ dataIndex: 'transfer_product_id', filter: { type: 'select' } }, columns[1]]), null);
  const mapper = getProductVariantFilterConfig([columns[0], { dataIndex: 'size_id', filter: { type: 'select' } }]);
  assert.deepEqual(mapper.children, [{ key: 'size_id', table: 'product_size', valueField: 'id', multiple: false }]);
});

test('Doormat loads only its sizes/colors from generic-list and preserves name-based filter values', async () => {
  const calls = [];
  const fields = config.children;
  const result = await loadProductVariantOptions(['doormat'], fields, async (table, payload) => {
    calls.push([table, payload]);
    return table === 'product_size' ? [{ id: 'doormat-small', name: 'Small' }] : [{ id: 'doormat-brown', name: 'Brown' }];
  });
  assert.deepEqual(calls, [
    ['product_size', { filters: { product_id: 'doormat' } }],
    ['product_color', { filters: { product_id: 'doormat' } }],
  ]);
  assert.deepEqual(result.size_name.options, [{ value: 'Small', label: 'Small' }]);
  assert.deepEqual(result.color_name.options, [{ value: 'Brown', label: 'Brown' }]);
});

test('ID-based lists get IDs belonging to the selected product rather than another product with the same size name', async () => {
  const fields = [{ key: 'size_id', table: 'product_size', valueField: 'id' }];
  const result = await loadProductVariantOptions(['doormat'], fields, async (_table, payload) => {
    assert.equal(payload.filters.product_id, 'doormat');
    return [{ id: 'doormat-large', name: 'Large' }];
  });
  assert.deepEqual(result.size_id.options, [{ value: 'doormat-large', label: 'Large' }]);
});

test('multiple selected products load their union and deduplicate shared names', async () => {
  const calls = [];
  const fields = [
    { key: 'size_id', table: 'product_size', valueField: 'id' },
    { key: 'size_name', table: 'product_size', valueField: 'name' },
  ];
  const result = await loadProductVariantOptions(['doormat', 'rug'], fields, async (table, payload) => {
    calls.push([table, payload.filters.product_id]);
    return [{ id: `${payload.filters.product_id}-large`, name: 'Large' }];
  });
  assert.deepEqual(calls, [['product_size', 'doormat'], ['product_size', 'rug']]);
  assert.equal(result.size_id.options.length, 2);
  assert.deepEqual(result.size_name.options, [{ value: 'Large', label: 'Large' }]);
});

test('a failed scoped request never falls back to another product or unscoped options', async () => {
  const failure = new Error('network unavailable');
  const result = await loadProductVariantOptions(['doormat'], config.children, async table => {
    if (table === 'product_size') throw failure;
    return [{ id: 'brown', name: 'Brown' }];
  });
  assert.equal(result.size_name.error, failure);
  assert.deepEqual(result.size_name.options, []);
  assert.deepEqual(result.color_name.options, [{ value: 'Brown', label: 'Brown' }]);
});

test('empty product variations yield empty dropdowns', async () => {
  const result = await loadProductVariantOptions(['doormat'], config.children, async () => []);
  assert.deepEqual(result.size_name, { error: null, options: [] });
  assert.deepEqual(result.color_name, { error: null, options: [] });
});
