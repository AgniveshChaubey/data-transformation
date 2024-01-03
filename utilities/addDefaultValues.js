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
        //future debugging - if (value.type === "object" && !Array.isArray(value)) {
        if (value.type === "object") {
          obj[key] = {};
          addDefaultsToObject(obj[key], value);
        } else if (value.type === "array" && Array.isArray(value.items)) {
          obj[key] = [];
          addDefaultsToArray(value.items, obj[key]);
        } else {
          obj[key] = value.default;
        }
      }
    }
  }
};

const addDefaultsToArray = (arr, resultantArr) => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].type !== "object" && arr[i].type !== "array") {
      resultantArr[i] = arr[i].default;
    } else if (arr[i].type === "object") {
      resultantArr[i] = {};
      addDefaultsToObject(resultantArr[i], arr[i]);
    } else if (arr[i].type === "array" && Array.isArray(arr[i].items)) {
      resultantArr[i] = [];
      addDefaultsToArray(arr[i].items, resultantArr[i]);
    }
  }
};

const hasProperty = (obj, targetProperty) => {
  if (obj && typeof obj === "object") {
    if (targetProperty in obj) {
      return true;
    } else {
      for (const key in obj) {
        if (hasProperty(obj[key], targetProperty)) {
          return true;
        }
      }
    }
  }
  return false;
};

export const addDefaultValuesToDocument = (schema, document) => {
  let parsedSchema;
  if (hasProperty(schema, "prefixItems")) {
    parsedSchema = schema;
  } else {
    try {
      parsedSchema = parseAndValidateSchema(schema, document);
    } catch (error) {
      return "Invalid JSON Schema: Schema must be an object.";
    }
    try {
      parseAndValidateDefaults(parsedSchema);
    } catch (error) {
      throw new Error(`Invalid default values: ${error.message}`);
    }
  }

  const addDefaults = (doc, parentSchema) => {
    addDefaultsToObject(doc, parentSchema);
  };

  try {
    addDefaults(document, parsedSchema);
  } catch (error) {
    throw new Error(`Error adding default values: ${error.message}`);
  }
  return document;
};


// FOR TESTING PURPOSE -This section will be removed later.
// const schema = {
//   type: "object",
//   properties: {
//     numbers: {
//       type: "array",
//       items: {
//         type: "number",
//       },
//       default: [40],
//     },
//   },
// };
// const document = {};

// const result = addDefaultValuesToDocument(schema, document);
// console.log(result);
