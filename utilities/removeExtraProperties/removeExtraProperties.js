import { registerSchema, unregisterSchema, validate } from "@hyperjump/json-schema/draft-2020-12";

export const removeExtraProperties = async (schema, document) => {
  unregisterSchema(schema.$id)
  registerSchema(schema);
  const result = await validate(schema.$id, document);
  if (!result.valid) console.warn(ajv.errors);
  removeExtras(schema, document);
  return document;
};

const removeExtras = (schema, doc) => {
  if (typeof schema === "object" && !Array.isArray(schema)) {
    if (schema.properties) {
      for (const key in doc) {
        if (!(key in schema.properties)) {
          delete doc[key];
        } else if (
          typeof schema.properties[key] === "object" &&
          !Array.isArray(schema.properties[key])
        ) {
          removeExtras(schema.properties[key], doc[key]);
        }
      }
    }
  }
};