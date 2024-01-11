import {
  registerSchema,
  unregisterSchema,
  validate,
} from "@hyperjump/json-schema/draft-2020-12";

export const addDefaults = async (schema, document) => {
  let parsedSchema;
  const result = await parseAndValidateSchema(schema, document);

  if (result === "Invalid Json Schema") {
    return "Invalid Json Schema";
  } else if (!result.isValid) {
    return "Invalid Instance";
  } else {
    parsedSchema = result.schema;
  }

  let updatedDocument;
  try {
    updatedDocument = addDefaultsToObject(parsedSchema, document);
  } catch (error) {
    console.error("Error adding default values", { cause: error });
    return "Error adding default values";
  }
  return updatedDocument;
};

const parseAndValidateSchema = async (schema, document) => {
  try {
    registerSchema(schema);
    const result = await validate(schema.$id, document);

    const isValid = result.valid;
    unregisterSchema(schema.$id);

    return { schema, isValid };
  } catch (error) {
    console.error("Error validating the Schema", { cause: error });
    return "Invalid Json Schema";
  }
};

const addDefaultsToObject = (schema, obj) => {
  if (schema.type === "object" || schema.properties) {
    for (const propertyName in schema.properties) {
      const propertyValue = schema.properties[propertyName];

      if (obj[propertyName] === undefined || obj[propertyName] === null) {
        if (propertyValue.default) {
          obj[propertyName] = propertyValue.default;
        } else if (propertyValue.$ref) {
          obj[propertyName] = addDefaultsToObject(
            resolveRef(propertyValue.$ref, schema),
            obj
          );
        } else if (propertyValue.type === "object") {
          obj[propertyName] = {};
          addDefaultsToObject(propertyValue, obj[propertyName]);
        } else if (propertyValue.type === "array") {
          if (propertyValue.default) {
            obj[propertyName] = propertyValue.default;
          } else {
            obj[propertyName] = [];
            if (Array.isArray(propertyValue.prefixItems)) {
              addDefaultsToArray(propertyValue, obj[propertyName]);
            }
          }
        }
      }
    }
  } else if (schema.type === "array" || schema.prefixItems || schema.items) {
    return addDefaultsToArray(schema, obj);
  } else {
    return schema.default;
  }
  return obj;
};

const addPrefixDefaults = (prefixItemsArr, instanceArr) => {
  for (let i = 0; i < prefixItemsArr.length; i++) {
    if (instanceArr[i] === undefined || instanceArr[i] === null) {
      if (prefixItemsArr[i].default) {
        instanceArr[i] = prefixItemsArr[i].default;
      } else return instanceArr;
    } else if (
      prefixItemsArr[i].type === "object" ||
      prefixItemsArr[i].properties
    ) {
      instanceArr[i] = {};
      addDefaultsToObject(prefixItemsArr[i], instanceArr[i]);
    } else if (
      prefixItemsArr[i].type === "array" ||
      prefixItemsArr[i].prefixItems ||
      prefixItemsArr[i].items
    ) {
      // instanceArr[i] ??= [];
      addDefaultsToArray(prefixItemsArr[i], instanceArr[i]);
    } else {
      addDefaultsToObject(prefixItemsArr[i], instanceArr);
    }
  }
  return instanceArr;
};

const addDefaultsToArray = (schema, arr) => {
  let resultantArr = arr;
  if (schema.prefixItems) {
    resultantArr = addPrefixDefaults(schema.prefixItems, arr);
  }

  if (schema.items) {
    const prefixArrLength = schema.prefixItems ? schema.prefixItems.length : 0;
    for (let i = prefixArrLength; i < arr.length; i++) {
      addDefaultsToObject(schema.items, arr[i]);
    }
  }

  return resultantArr;
};

const resolveRef = (ref, schema) => {
  const parts = ref.split("/");
  let node = schema;

  for (let i = 1; i < parts.length; i++) {
    node = node[parts[i]];
  }

  return node;
};

// FOR TESTING PURPOSE -This section will be removed later.
const schema = {
  $id: "https://example.com/4",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "array",
  prefixItems: [{ type: "string", default: "Agni" }],
  // prefixItems: [true],
  // items: {
  //   type: "object",
  //   properties: {
  //     foo: { default: 42 },
  //   },
  // },
};

const document = [{}, {}, { foo: true }, {}];

const result = await addDefaults(schema, document);
// // console.log(schema);
console.log(result);
