import { validate } from "@hyperjump/json-schema/draft-2020-12";
import {
  dataType,
  parseAndValidateSchema,
  resolveRef,
} from "../helpers.js";

export const addDefaults = async (schema, document, seq) => {
  let parsedSchema;
  const schemaId = schema.$id + seq;
  const result = await parseAndValidateSchema(schema, document, schemaId);

  if (result === "Invalid Json Schema") {
    return "Invalid Json Schema";
  } else if (!result.isValid) {
    return "Invalid Instance";
  } else {
    parsedSchema = result.schema;
  }

  let updatedDocument;
  try {
    updatedDocument = addDefaultsToObject(parsedSchema, document, schemaId);
  } catch (error) {
    console.error("Error adding default values", { cause: error });
    return "Error adding default values";
  }
  return updatedDocument;
};

const addDefaultsToObject = (schema, obj, schemaId) => {
  if (
    schema.type === "object" ||
    schema.properties ||
    schema.additionalProperties
  ) {
    if (schema.properties) {
      addDefaults_properties(schema, schema.properties, obj);
    }
    if (schema.additionalProperties) {
      addDefaults_additionalProperties(schema.additionalProperties, obj);
    }
  }
  if (schema.type === "array" || schema.prefixItems || schema.items) {
    return addDefaultsToArray(schema, obj);
  }
  if (schema.anyOf || schema.oneOf) {
    const arr = schema.anyOf ? schema.anyOf : schema.oneOf;
    return addDefaults_anyOf(arr, obj, schemaId);
  }
  if (schema.if) {
    return addDefaults_if(schema, obj, schemaId);
  }
  if (schema.dependentSchemas) {
    return addDefaults_dependentSchemas(schema, obj);
  }
  if (schema.propertyDependencies) {
    return addDefaults_propertyDependencies(schema, obj);
  }
  return schema.default || obj;
};

const addDefaultsToArray = (schema, arr) => {
  let resultantArr = arr;
  if (schema.prefixItems) {
    resultantArr = addDefaults_prefixItems(schema.prefixItems, arr);
  }
  if (schema.items) {
    const prefixArrLength = schema.prefixItems ? schema.prefixItems.length : 0;
    for (let i = prefixArrLength; i < arr.length; i++) {
      addDefaultsToObject(schema.items, arr[i]);
    }
  }
  if (schema.contains) {
    addDefaults_contains(schema.contains, arr);
  }
  return resultantArr;
};

const addDefaults_properties = (schema, properties, obj) => {
  for (const propertyName in properties) {
    const propertyValue = properties[propertyName];
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
  return obj;
};

const addDefaults_additionalProperties = (additionalProps, obj) => {
  for (const property in obj) {
    addDefaultsToObject(additionalProps, obj[property]);
  }
};

const addDefaults_if = async (schema, obj, schemaId) => {
  const subSchemaPath = `${schemaId}#/if`;
  const result = await validate(subSchemaPath, obj);
  if (result.valid) {
    let collectDefaults;
    collectDefaults = addDefaultsToObject(schema.if, obj);
    if (schema.then) {
      collectDefaults = {
        ...collectDefaults,
        ...addDefaultsToObject(schema.then, obj),
      };
    }
    return collectDefaults;
  } else {
    return addDefaultsToObject(schema.else, obj);
  }
};

const addDefaults_anyOf = async (arr, obj) => {
  const objCopy = JSON.parse(JSON.stringify(obj));
  for (let i = 0; i < arr.length; i++) {
    const result = addDefaultsToObject(arr[i], obj);
    if (result !== objCopy) {
      return result;
    }
  }
};

const addDefaults_dependentSchemas = (schema, obj) => {
  for (const instanceProperty in schema.dependentSchemas) {
    const dependentSchema = schema.dependentSchemas[instanceProperty];
    if (obj.hasOwnProperty(instanceProperty)) {
      addDefaultsToObject(dependentSchema, obj);
    }
  }
  return obj;
};

const addDefaults_propertyDependencies = (schema, obj) => {
  for (const sourceProperty in schema.propertyDependencies) {
    const dependentSchema = schema.propertyDependencies[sourceProperty];
    if (
      obj.hasOwnProperty(sourceProperty) &&
      dependentSchema.hasOwnProperty(obj[sourceProperty])
    ) {
      const defaultValueNode = dependentSchema[obj[sourceProperty]];
      addDefaultsToObject(defaultValueNode, obj);
    }
  }
  return obj;
};

const addDefaults_contains = (schema, instanceArr) => {
  const datatype = dataType(schema);
  for (let i = 0; i < instanceArr.length - 1; i++) {
    if (typeof (instanceArr[i] === datatype)) {
      const allElementsPresent = schema.required.every((element) =>
        instanceArr[i].hasOwnProperty(element)
      );
      if (allElementsPresent) {
        addDefaultsToObject(schema, instanceArr[i]);
      }
    }
  }
};

const addDefaults_prefixItems = (prefixItemsArr, instanceArr) => {
  for (let i = 0; i < prefixItemsArr.length; i++) {
    if (instanceArr[i] === undefined || instanceArr[i] === null) {
      if (prefixItemsArr[i].default) {
        instanceArr[i] = prefixItemsArr[i].default;
      } else return instanceArr;
    }
    addDefaultsToObject(prefixItemsArr[i], instanceArr[i]);
  }
  return instanceArr;
};

// FOR TESTING PURPOSE -This section will be removed later.
// const schema = {
//   $id: "https://example.com/0",
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   oneOf: [
//     {
//       not: {
//         type: "object",
//         properties: {
//           aaa: { const: 42 },
//         },
//         required: ["aaa"],
//       },
//     },
//     {
//       properties: {
//         ccc: { default: "foo" },
//       },
//     },
//   ],
// };

// const document = { aaa: 42, bbb: true };
// const result = await addDefaults(schema, document, "-0");
// console.log(result);
