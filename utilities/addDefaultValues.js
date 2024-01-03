import Ajv from "ajv";
const ajv = new Ajv();

const parseAndValidateSchema = (schema, document) => {
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
        // if (value.type === "object" && !Array.isArray(value)) {
        if (value.type === "object") {
          obj[key] = {};
          addDefaultsToObject(obj[key], value);
        } else {
          obj[key] = value.default;
        }
      }
    }
  }
};

const addDefaultsToArray = (arr, schema) => {
  if (schema.items && Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      if (schema.items.default !== undefined) {
        arr[i] = schema.items.default;
      }

      if (typeof schema.items === "object" && !Array.isArray(schema.items)) {
        addDefaultsToObject(arr[i], schema.items);
      }
    }
  }
};

export const addDefaultValuesToDocument = (schema, document) => {
  let parsedSchema;
  try {
    parsedSchema = parseAndValidateSchema(schema, document);
  } catch (error) {
    throw new Error(`Invalid JSON Schema: ${error.message}`);
  }
  try {
    parseAndValidateDefaults(parsedSchema);
  } catch (error) {
    throw new Error(`Invalid default values: ${error.message}`);
  }

  const addDefaults = (doc, parentSchema) => {
    addDefaultsToObject(doc, parentSchema);

    if (parentSchema.items) {
      if (Array.isArray(doc)) {
        addDefaultsToArray(doc, parentSchema);
      }
    }
  };

  try {
    addDefaults(document, parsedSchema);
  } catch (error) {
    throw new Error(`Error adding default values: ${error.message}`);
  }
  return document;
};

const schema = {
  type: "object",
  properties: {
    person: {
      type: "object",
      properties: {
        name: {
          type: "string",
          default: "John",
        },
        age: {
          type: "number",
          default: 25,
        },
      },
    },
  },
};

const document = {};

const result = addDefaultValuesToDocument(schema, document);
console.log(result);
