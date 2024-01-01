import Ajv from "ajv";
const ajv = new Ajv();

export const addDefaultValues = (schema, document) => {
  const isValid = ajv.validate(schema, document);
  if (!isValid) console.warn(ajv.errors);

  const addDefauls = (schema, doc) => {
    if (typeof schema === "object" && !Array.isArray(schema)) {
      for (const key in schema.properties) {
        if (
          doc[key] === undefined &&
          schema.properties[key].default !== undefined
        ) {
          doc[key] = schema.properties[key].default;
        } else if (
          typeof schema.properties[key] === "object" &&
          !Array.isArray(schema.properties[key])
        ) {
          if (doc[key] === undefined) {
            doc[key] = {};
          }
          addDefauls(schema.properties[key], doc[key]);
        }
      }
    }
  };

  addDefauls(schema, document);
  return document;
};
