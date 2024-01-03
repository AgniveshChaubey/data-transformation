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

const addDefaultsToObject = (obj, schema) => {
  if (schema.properties) {
    for (const key in schema.properties) {
      const value = schema.properties[key];

      if (obj[key] === undefined || obj[key] === null) {
        obj[key] = value.default;
      }

      if (typeof value === "object" && !Array.isArray(value)) {
        addDefaultsToObject(obj[key], value);
      }
    }
  }
};

const addDefaultsToArray = (arr, schema) => {
  if (schema.items && Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === undefined || arr[i] === null) {
        arr[i] = schema.items.default;
      }

      if (typeof schema.items === "object" && !Array.isArray(schema.items)) {
        addDefaultsToObject(arr[i], schema.items);
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
