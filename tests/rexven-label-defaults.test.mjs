import assert from "node:assert/strict";
import test from "node:test";
import { getRexvenLabelDefaults } from "../src/components/orders/rexven/rexvenLabelDefaults.mjs";

test("fills all modal defaults when the preview response omits settings", () => {
  assert.deepEqual(getRexvenLabelDefaults(), {
    dtfMachineWidth: 22,
    arrangementOption: "sequential-optimal",
    designSpacing: "0.1",
    labelOrder: "product-name",
    outputType: "order_info_only",
    mockupSize: "normal",
    printConfig: { printType: "normal" },
  });
});

test("uses server settings and fills missing or empty defaults", () => {
  const values = getRexvenLabelDefaults({
    dtfMachineWidth: 30,
    outputType: null,
    labelOrder: "",
    designSpacing: undefined,
    printConfig: {},
  });
  assert.equal(values.dtfMachineWidth, 30);
  assert.equal(values.outputType, "order_info_only");
  assert.equal(values.labelOrder, "product-name");
  assert.equal(values.designSpacing, "0.1");
  assert.deepEqual(values.printConfig, { printType: "normal" });
});

test("reopening the modal gets fresh defaults without previous edits", () => {
  const first = getRexvenLabelDefaults();
  first.dtfMachineWidth = 44;
  first.printConfig.printType = "ornament";
  assert.equal(getRexvenLabelDefaults().dtfMachineWidth, 22);
  assert.deepEqual(getRexvenLabelDefaults().printConfig, {
    printType: "normal",
  });
});

test("retains server ornament configuration", () => {
  const printConfig = {
    printType: "ornament",
    ornament: { pageWidth: 22, pageHeight: 24, spacing: 0 },
  };
  assert.deepEqual(
    getRexvenLabelDefaults({ printConfig }).printConfig,
    printConfig,
  );
});

test("normal mode sends DTF settings and strips ornament and removed advanced fields", async () => {
  const { buildRexvenLabelOptions } = await import(
    "../src/components/orders/rexven/rexvenLabelDefaults.mjs"
  );
  const options = buildRexvenLabelOptions({
    ...getRexvenLabelDefaults(),
    designSpacing: "0,25",
    printConfig: {
      printType: "normal",
      ornament: { pageWidth: 24, pageHeight: 17, spacing: 0.1 },
    },
    selectedDesignsJson: "[]",
    selectedDesigns: [{ orderId: 1 }],
    excludedProductVariantIds: [1],
    groupSettings: [{ productId: 1 }],
  });
  assert.deepEqual(options, {
    labelOrder: "product-name",
    outputType: "order_info_only",
    mockupSize: "normal",
    dtfMachineWidth: 22,
    arrangementOption: "sequential-optimal",
    designSpacing: "0.25",
    printConfig: { printType: "normal" },
  });
});

test("ornament mode sends jig dimensions without hidden DTF settings", async () => {
  const { buildRexvenLabelOptions } = await import(
    "../src/components/orders/rexven/rexvenLabelDefaults.mjs"
  );
  const options = buildRexvenLabelOptions({
    ...getRexvenLabelDefaults(),
    printConfig: {
      printType: "ornament",
      ornament: { pageWidth: 30, pageHeight: 20, spacing: 0 },
    },
  });
  assert.deepEqual(options, {
    labelOrder: "product-name",
    outputType: "order_info_only",
    mockupSize: "normal",
    printConfig: {
      printType: "ornament",
      ornament: { pageWidth: 30, pageHeight: 20, spacing: 0 },
    },
  });
});

test("ornament mode has the reference jig defaults", async () => {
  const { buildRexvenLabelOptions } = await import(
    "../src/components/orders/rexven/rexvenLabelDefaults.mjs"
  );
  assert.deepEqual(
    buildRexvenLabelOptions({ printConfig: { printType: "ornament" } })
      .printConfig.ornament,
    { pageWidth: 24, pageHeight: 17, spacing: 0.1 },
  );
});
