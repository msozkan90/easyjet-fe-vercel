const REXVEN_LABEL_DEFAULTS = {
  dtfMachineWidth: 22,
  arrangementOption: "sequential-optimal",
  designSpacing: "0.1",
  labelOrder: "product-name",
  outputType: "order_info_only",
  mockupSize: "normal",
  printConfig: { printType: "normal" },
};

export function getRexvenLabelDefaults(defaults) {
  const provided = Object.fromEntries(
    Object.entries(defaults ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  );
  return {
    ...REXVEN_LABEL_DEFAULTS,
    ...provided,
    printConfig: {
      ...REXVEN_LABEL_DEFAULTS.printConfig,
      ...provided.printConfig,
      printType: provided.printConfig?.printType || "normal",
    },
  };
}

export function buildRexvenLabelOptions(values) {
  const options = getRexvenLabelDefaults(values);
  const common = {
    labelOrder: options.labelOrder,
    outputType: options.outputType,
    mockupSize: options.mockupSize,
  };
  if (options.printConfig.printType === "ornament") {
    return {
      ...common,
      printConfig: {
        printType: "ornament",
        ornament: {
          pageWidth: options.printConfig.ornament?.pageWidth ?? 24,
          pageHeight: options.printConfig.ornament?.pageHeight ?? 17,
          spacing: options.printConfig.ornament?.spacing ?? 0.1,
        },
      },
    };
  }
  return {
    ...common,
    dtfMachineWidth: options.dtfMachineWidth,
    arrangementOption: options.arrangementOption,
    designSpacing: String(options.designSpacing).replace(",", "."),
    printConfig: { printType: "normal" },
  };
}
