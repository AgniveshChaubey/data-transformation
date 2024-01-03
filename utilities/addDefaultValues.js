import Ajv from "ajv";
const ajv = new Ajv();

const parseAndValidateSchema = (schema) => {
  if (typeof schema !== "object" || schema === null) {
    throw new Error("Invalid Json Schema: Schema must be an object");
  }
  const isValid = ajv.validate(schema, document);
  // eslint-disable-next-line no-console
  if (!isValid) console.warn(ajv.errors);

  return schema;
};

const parseAndValidateDefaults = (schema) => {
  const defaults = {};
  if (schema.properties) {
    for (const key in schema.properties) {
      const value = schema.properties[key];

      if (value.default !== undefined) {
        defaults[key] = value.default;
      }
    }
  }
  return defaults;
};

const addDefaultsToObjects = (obj, schema) => {
  if (schema.properties) {
    for (const key in schema.properties) {
      const value = schema.properties[key];

      if (obj[key] === undefined || obj[key] === null) {
        obj[key] = value.default;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        addDefaultsToObjects(obj[key], value);
      }
    }
  }
};

export const addDefaultValues = (schema, document) => {
  const addDefaults = (schema, doc) => {
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
          addDefaults(schema.properties[key], doc[key]);
        }
      }
    }
  };
  if (schema.required) {
    const modifiedSchema = { ...schema };
    for (const key in schema.properties) {
      if (!schema.required.includes(key)) {
        delete modifiedSchema.properties[key];
      }
    }
    addDefaults(modifiedSchema, document);
  } else {
    addDefaults(schema, document);
  }
  return document;
};
