import { registerSchema, validate } from "@hyperjump/json-schema";

export const parseAndValidateSchema = async (schema, document, schemaId) => {
  try {
    registerSchema(schema, schemaId);
    const result = await validate(schemaId, document);

    return schema;
  } catch (error) {
    throw new Error(error);
  }
};

export const dataType = (schema) => {
  if (schema.properties || schema.additionalProperties) {
    return "object";
  }

  if (schema.prefixItems || schema.items || schema.contains) {
    return "array";
  }

  return schema.type || typeof schema.default;
};

export const resolveRef = (ref, schema) => {
  const parts = ref.split("/");
  let node = schema;
  for (let i = 1; i < parts.length; i++) {
    node = node[parts[i]];
  }
  return node;
};
