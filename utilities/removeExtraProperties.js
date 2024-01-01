/* eslint-disable no-prototype-builtins */
import Ajv from "ajv";
const ajv = new Ajv();

export const removeExtraProperties = (schema, document) => {
  console.log(document);
  const isValid = ajv.validate(schema, document);

  if (!isValid) console.warn(ajv.errors);

  const removeExtras = (schema, doc) => {
    if (typeof schema === "object" && !Array.isArray(schema)) {
      if (schema.properties) {
        for (let key in doc) {
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

  removeExtras(schema, document);
  console.log(document);

  return document;
};
