import {
  registerSchema,
  unregisterSchema,
  validate,
} from "@hyperjump/json-schema/draft-2020-12";

const parseAndValidateSchema = async (schema, document) => {
  try {
    console.log("000000", schema);
    registerSchema(schema);
    const result = await validate(schema.$id, document);
    console.log("1111111", result);
    unregisterSchema(schema.$id);
    return schema;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error({ cause: error });
    return "Invalid Json Schema";
  }
};

// const parseAndValidateDefaults = (schema) => {
//   const defaults = {};
//   if (schema.properties) {
//     for (const key in schema.properties) {
//       const value = schema.properties[key];

//       if (value.default !== undefined) {
//         defaults[key] = value.default;
//       }
//     }
//   }
//   console.log("444444", defaults);
//   return defaults;
// };

const addDefaultsToObject = (schema, obj) => {
  console.log("55555", schema, obj);
  if (schema.properties) {
    for (const key in schema.properties) {
      const value = schema.properties[key];

      if (obj[key] === undefined || obj[key] === null) {
        // future debugging - if (value.type === "object" && !Array.isArray(value)) {
        if (value.type === "object") {
          obj[key] = {};
          addDefaultsToObject(value, obj[key]);
        } else if (value.type === "array") {
          if (value.default) {
            obj[key] = value.default;
          } else {
            obj[key] = [];
            if (Array.isArray(value.items)) {
              addDefaultsToArray(value.items, obj[key]);
            } else if (Array.isArray(value.prefixItems)) {
              addDefaultsToArray(value.prefixItems, obj[key]);
            }
          }
        } else {
          obj[key] = value.default;
          console.log("6666666", obj[key]);
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
      addDefaultsToObject(arr[i], resultantArr[i]);
    } else if (arr[i].type === "array") {
      resultantArr[i] = [];
      if (Array.isArray(arr[i].items)) {
        addDefaultsToArray(arr[i].items, resultantArr[i]);
      } else if (Array.isArray(arr[i].prefixItems)) {
        addDefaultsToArray(arr[i].prefixItems, resultantArr[i]);
      }
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

export const addDefaultValuesToDocument = async (schema, document) => {
  let parsedSchema;

  try {
    parsedSchema = await parseAndValidateSchema(schema, document);
    console.log("333333", parsedSchema);
  } catch (error) {
    parsedSchema = "Invalid Json Schema";
  }

  if (parsedSchema === "Invalid Json Schema") {
    return "Invalid Json Schema";
  }
  // else {
  //   try {
  //     parseAndValidateDefaults(parsedSchema);
  //   } catch (error) {
  //     throw new Error(`Invalid default values: ${error.message}`);
  //   }
  // }

  try {
    addDefaultsToObject(parsedSchema, document);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error({ cause: error });
    return "Invalid Json Schema";
  }
  return document;
};

// FOR TESTING PURPOSE -This section will be removed later.
// const schema = "";
const schema = {
  $id: "https://example.com/4",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    numbers: {
      type: "array",
      prefixItems: [
        {
          type: "number",
          default: 39,
        },
        {
          type: "string",
          default: "foo",
        },
        {
          type: "object",
          properties: {
            name: {
              type: "string",
              default: "Logan",
            },
          },
        },
        {
          type: "array",
          prefixItems: [
            {
              type: "string",
              default: "Agnivesh",
            },
            {
              type: "number",
              default: 99999,
            },
          ],
        },
      ],
    },
  },
};

const document = {
  // numbers: [
  //   23,
  //   "foo",
  //   {
  //     name: "Agni",
  //   },
  //   ["Chaubey", 27],
  // ],
};

const result = await addDefaultValuesToDocument(schema, document);
console.log(result);
