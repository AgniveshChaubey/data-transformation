import { validate } from "@hyperjump/json-schema/draft-2020-12";
import { dataType, parseAndValidateSchema, resolveRef } from "../helpers.js";

export class JsonSchemaProcessor {
  constructor(schema, instance, seq) {
    this.schema = schema;
    this.instance = instance;
    this.schemaId = this.schema.$id + seq;
    this.parsedSchema;
  }

  addDefaultsToinstance = async () => {
    const result = await parseAndValidateSchema(
      this.schema,
      this.instance,
      this.schemaId
    );

    if (result === "Invalid Json Schema") {
      return "Invalid Json Schema";
    } else if (!result.isValid) {
      return "Invalid Instance";
    } else {
      this.parsedSchema = result.schema;
    }

    let updatedDocument;

    try {
      const schemaDefaults = new SchemaDefaults();
      updatedDocument = schemaDefaults.addDefaults(
        this.parsedSchema,
        this.instance,
        this.schemaId
      );
    } catch (error) {
      console.error("Error adding default values", { cause: error });
      return "Error adding default values";
    }
    return updatedDocument;
  };
}

class SchemaDefaults {
  addDefaults = (schema, instance, schemaId) => {
    if (
      schema.type === "object" ||
      schema.properties ||
      schema.additionalProperties
    ) {
      if (schema.properties) {
        addDefaults_properties(schema, schema.properties, instance);
      }
      if (schema.additionalProperties) {
        addDefaults_additionalProperties(schema.additionalProperties, instance);
      }
    }
    if (schema.type === "array" || schema.prefixItems || schema.items) {
      return this.addDefaultsToArray(schema, instance);
    }
    if (schema.anyOf || schema.oneOf) {
      const arr = schema.anyOf ? schema.anyOf : schema.oneOf;
      return addDefaults_anyOf(arr, instance, schemaId);
    }
    if (schema.if) {
      return addDefaults_if(schema, instance, schemaId);
    }
    if (schema.dependentSchemas) {
      return addDefaults_dependentSchemas(schema, instance);
    }
    if (schema.propertyDependencies) {
      return addDefaults_propertyDependencies(schema, instance);
    }
    return schema.default || instance;
  };

  addDefaultsToArray = (schema, instance) => {
    let resultantArr = instance;
    if (schema.prefixItems) {
      resultantArr = addDefaults_prefixItems(schema.prefixItems, instance);
    }
    if (schema.items) {
      const prefixArrLength = schema.prefixItems
        ? schema.prefixItems.length
        : 0;
      for (let i = prefixArrLength; i < instance.length; i++) {
        this.addDefaults(schema.items, instance[i]);
      }
    }
    if (schema.contains) {
      addDefaults_contains(schema.contains, instance);
    }
    return resultantArr;
  };
}

const addDefaults_properties = (schema, properties, obj) => {
  const addDefaults = new SchemaDefaults();
  for (const propertyName in properties) {
    const propertyValue = properties[propertyName];
    if (obj[propertyName] === undefined || obj[propertyName] === null) {
      if (propertyValue.default) {
        obj[propertyName] = propertyValue.default;
      } else if (propertyValue.$ref) {
        obj[propertyName] = addDefaults.addDefaults(
          resolveRef(propertyValue.$ref, schema),
          obj
        );
      } else if (propertyValue.type === "object") {
        obj[propertyName] = {};
        addDefaults.addDefaults(propertyValue, obj[propertyName]);
      } else if (propertyValue.type === "array") {
        if (propertyValue.default) {
          obj[propertyName] = propertyValue.default;
        } else {
          obj[propertyName] = [];
          if (Array.isArray(propertyValue.prefixItems)) {
            addDefaults.addDefaultsToArray(propertyValue, obj[propertyName]);
          }
        }
      }
    }
  }
  return obj;
};

const addDefaults_additionalProperties = (additionalProps, obj) => {
  const addDefaults = new SchemaDefaults();
  for (const property in obj) {
    addDefaults.addDefaults(additionalProps, obj[property]);
  }
};

const addDefaults_if = async (schema, obj, schemaId) => {
  const addDefaults = new SchemaDefaults();
  const subSchemaPath = `${schemaId}#/if`;
  const result = await validate(subSchemaPath, obj);
  if (result.valid) {
    let collectDefaults;
    collectDefaults = addDefaults.addDefaults(schema.if, obj);
    if (schema.then) {
      collectDefaults = {
        ...collectDefaults,
        ...addDefaults.addDefaults(schema.then, obj),
      };
    }
    return collectDefaults;
  } else {
    return addDefaults.addDefaults(schema.else, obj);
  }
};

const addDefaults_anyOf = async (arr, obj) => {
  const addDefaults = new SchemaDefaults();
  const objCopy = JSON.parse(JSON.stringify(obj));
  for (let i = 0; i < arr.length; i++) {
    const result = addDefaults.addDefaults(arr[i], obj);
    if (result !== objCopy) {
      return result;
    }
  }
};

const addDefaults_dependentSchemas = (schema, obj) => {
  const addDefaults = new SchemaDefaults();
  for (const instanceProperty in schema.dependentSchemas) {
    const dependentSchema = schema.dependentSchemas[instanceProperty];
    if (obj.hasOwnProperty(instanceProperty)) {
      addDefaults.addDefaults(dependentSchema, obj);
    }
  }
  return obj;
};

const addDefaults_propertyDependencies = (schema, obj) => {
  const addDefaults = new SchemaDefaults();
  for (const sourceProperty in schema.propertyDependencies) {
    const dependentSchema = schema.propertyDependencies[sourceProperty];
    if (
      obj.hasOwnProperty(sourceProperty) &&
      dependentSchema.hasOwnProperty(obj[sourceProperty])
    ) {
      const defaultValueNode = dependentSchema[obj[sourceProperty]];
      addDefaults.addDefaults(defaultValueNode, obj);
    }
  }
  return obj;
};

const addDefaults_contains = (schema, instanceArr) => {
  const addDefaults = new SchemaDefaults();
  const datatype = dataType(schema);
  for (let i = 0; i < instanceArr.length - 1; i++) {
    if (typeof (instanceArr[i] === datatype)) {
      const allElementsPresent = schema.required.every((element) =>
        instanceArr[i].hasOwnProperty(element)
      );
      if (allElementsPresent) {
        addDefaults.addDefaults(schema, instanceArr[i]);
      }
    }
  }
};

const addDefaults_prefixItems = (prefixItemsArr, instanceArr) => {
  const addDefaults = new SchemaDefaults();
  for (let i = 0; i < prefixItemsArr.length; i++) {
    if (instanceArr[i] === undefined || instanceArr[i] === null) {
      if (prefixItemsArr[i].default) {
        instanceArr[i] = prefixItemsArr[i].default;
      } else return instanceArr;
    }
    addDefaults.addDefaults(prefixItemsArr[i], instanceArr[i]);
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

// const instance = { aaa: 42, bbb: true };
// const result = await addDefaults(schema, instance, "-0");
// console.log(result);
