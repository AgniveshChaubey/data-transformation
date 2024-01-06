import {
  registerSchema,
  unregisterSchema,
  validate,
} from "@hyperjump/json-schema/draft-2020-12";

export const addDefaults = async (schema, document) => {
  let parsedSchema;

  try {
    parsedSchema = await parseAndValidateSchema(schema, document);
  } catch (error) {
    parsedSchema = "Invalid Json Schema";
  }

  if (parsedSchema === "Invalid Json Schema") {
    return "Invalid Json Schema";
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
    await validate(schema.$id, document);
    unregisterSchema(schema.$id);
    return schema;
  } catch (error) {
    console.error("Error validating the Schema", { cause: error });
    return "Invalid Json Schema";
  }
};

const addDefaultsToObject = (schema, obj) => {
  if (schema.properties) {
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
            if (Array.isArray(propertyValue.items)) {
              addDefaultsToArray(propertyValue.items, obj[propertyName]);
            } else if (Array.isArray(propertyValue.prefixItems)) {
              addDefaultsToArray(propertyValue.prefixItems, obj[propertyName]);
            }
          }
        }
      }
    }
  } else if (schema.allof) {
    for (let i = 0; i < schema.allof.length; i++) {
      addDefaultsToObject(schema.allof[i], obj);
    }
  } else {
    return schema.default;
  }
  return obj;
};

const addDefaultsToArray = (itemsArr, resultantArr) => {
  for (let i = 0; i < itemsArr.length; i++) {
    if (itemsArr[i].type !== "object" && itemsArr[i].type !== "array") {
      resultantArr[i] = itemsArr[i].default;
    } else if (itemsArr[i].type === "object") {
      resultantArr[i] = {};
      addDefaultsToObject(itemsArr[i], resultantArr[i]);
    } else if (itemsArr[i].type === "array") {
      resultantArr[i] = [];
      if (Array.isArray(itemsArr[i].items)) {
        addDefaultsToArray(itemsArr[i].items, resultantArr[i]);
      } else if (Array.isArray(itemsArr[i].prefixItems)) {
        addDefaultsToArray(itemsArr[i].prefixItems, resultantArr[i]);
      }
    }
  }
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
// const schema = {
//   $id: "https://example.com/4",
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   // allOf: [{ default: 42 }, { default: "foo" }],
// };

// const document = null;

// const result = await addDefaults(schema, document);
// console.log(result);
