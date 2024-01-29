export const dataType = (schema) => {
  if (
    schema.type === "object" ||
    schema.properties ||
    schema.additionalProperties
  ) {
    return "object";
  } else if (
    schema.type === "array" ||
    schema.prefixItems ||
    schema.items ||
    schema.contains
  ) {
    return "array";
  } else if (schema.type === null) {
    return null;
  } else if (schema.type === undefined) {
    return undefined;
  } else {
    return schema.type || typeof schema.default;
  }
};

export const isLogicalImplication = (oneOf) => {
  const [subSchema1, subSchema2] = oneOf;
  return subSchema1.not ? true : false;
};
