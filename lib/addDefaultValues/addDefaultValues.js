import { validate } from "@hyperjump/json-schema/draft-2020-12";
import { dataType, parseAndValidateSchema, resolveRef } from "../helpers.js";

export class JsonSchemaProcessor {
  constructor(schema, instance, seq) {
    this.schema = schema;
    this.instance = instance;
    this.schemaId = this.schema.$id + seq;
  }

  addDefaultsToinstance = async () => {
    try {
      const validatedSchema = await parseAndValidateSchema(
        this.schema,
        this.instance,
        this.schemaId
      );

      const schemaDefaults = new SchemaDefaults();
      return schemaDefaults.addDefaults(
        validatedSchema,
        this.instance,
        this.schemaId
      );
    } catch (error) {
      throw new Error(error.message);
    }
  };
}

class SchemaDefaults {
  keywords = new Keywords();
  addDefaults = (schema, instance, schemaId) => {
    if (schema.properties) {
      this.keywords._properties(schema, schema.properties, instance);
    }
    if (schema.additionalProperties) {
      this.keywords._additionalProperties(
        schema.additionalProperties,
        instance
      );
    }
    if (schema.prefixItems || schema.items || schema.contains) {
      return this.addDefaultsToArray(schema, instance);
    }
    if (schema.anyOf || schema.oneOf) {
      const arr = schema.anyOf ? schema.anyOf : schema.oneOf;
      return this.keywords._anyOf(arr, instance, schemaId);
    }
    if (schema.if) {
      return this.keywords._if(schema, instance, schemaId);
    }
    if (schema.dependentSchemas) {
      return this.keywords._dependentSchemas(schema, instance);
    }
    if (schema.propertyDependencies) {
      return this.keywords._propertyDependencies(schema, instance);
    }
    return schema.default || instance;
  };

  addDefaultsToArray = (schema, instance) => {
    let resultantArr = instance;
    if (schema.prefixItems) {
      resultantArr = this.keywords._prefixItems(schema.prefixItems, instance);
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
      this.keywords._contains(schema.contains, instance);
    }
    return resultantArr;
  };
}

class Keywords {
  _properties = (schema, properties, obj) => {
    const schemaDefaults = new SchemaDefaults();
    let objectHasDefault = false;

    const handleDefault = (propertyName, propertyValue) => {
      if (propertyValue.default) {
        objectHasDefault = true;
        obj[propertyName] = propertyValue.default;
      }
    };

    const handleRef = (propertyName, propertyValue) => {
      if (!objectHasDefault && propertyValue.$ref) {
        obj[propertyName] = schemaDefaults.addDefaults(
          resolveRef(propertyValue.$ref, schema),
          obj
        );
      }
    };

    const handleObject = (propertyName, propertyValue) => {
      if (!objectHasDefault && propertyValue.type === "object") {
        obj[propertyName] = {};
        schemaDefaults.addDefaults(propertyValue, obj[propertyName]);
      }
    };

    const handleArray = (propertyName, propertyValue) => {
      if (!objectHasDefault && propertyValue.type === "array") {
        if (propertyValue.default) {
          obj[propertyName] = propertyValue.default;
        } else {
          obj[propertyName] = [];
          if (propertyValue.prefixItems) {
            schemaDefaults.addDefaultsToArray(propertyValue, obj[propertyName]);
          }
        }
      }
    };

    for (const propertyName in properties) {
      const propertyValue = properties[propertyName];
      if (obj[propertyName] === undefined || obj[propertyName] === null) {
        handleDefault(propertyName, propertyValue);
        handleRef(propertyName, propertyValue);
        handleObject(propertyName, propertyValue);
        handleArray(propertyName, propertyValue);
      }
    }

    return obj;
  };

  _additionalProperties = (additionalProps, obj) => {
    for (const property in obj) {
      new SchemaDefaults().addDefaults(additionalProps, obj[property]);
    }
  };

  _if = async (schema, obj, schemaId) => {
    const schemaDefaults = new SchemaDefaults();
    const subSchemaPath = `${schemaId}#/if`;
    const result = await validate(subSchemaPath, obj);

    if (result.valid) {
      const collectDefaults = schemaDefaults.addDefaults(schema.if, obj);
      return schema.then
        ? {
            ...collectDefaults,
            ...schemaDefaults.addDefaults(schema.then, obj),
          }
        : collectDefaults;
    } else {
      return schemaDefaults.addDefaults(schema.else, obj);
    }
  };

  _anyOf = async (arr, obj) => {
    const objCopy = { ...obj };
    for (let i = 0; i < arr.length; i++) {
      const result = new SchemaDefaults().addDefaults(arr[i], obj);
      if (result !== objCopy) {
        return result;
      }
    }
  };

  _dependentSchemas = (schema, obj) => {
    for (const instanceProperty in schema.dependentSchemas) {
      const dependentSchema = schema.dependentSchemas[instanceProperty];
      if (obj.hasOwnProperty(instanceProperty)) {
        new SchemaDefaults().addDefaults(dependentSchema, obj);
      }
    }
    return obj;
  };

  _propertyDependencies = (schema, obj) => {
    for (const sourceProperty in schema.propertyDependencies) {
      const dependentSchema = schema.propertyDependencies[sourceProperty];
      if (
        obj.hasOwnProperty(sourceProperty) &&
        dependentSchema.hasOwnProperty(obj[sourceProperty])
      ) {
        const defaultValueNode = dependentSchema[obj[sourceProperty]];
        new SchemaDefaults().addDefaults(defaultValueNode, obj);
      }
    }
    return obj;
  };

  _contains = (schema, instanceArr) => {
    const datatype = dataType(schema);
    for (let i = 0; i < instanceArr.length - 1; i++) {
      if (typeof instanceArr[i] === datatype) {
        const allElementsPresent = schema.required.every((element) =>
          instanceArr[i].hasOwnProperty(element)
        );
        if (allElementsPresent) {
          new SchemaDefaults().addDefaults(schema, instanceArr[i]);
        }
      }
    }
  };

  _prefixItems = (prefixItemsArr, instanceArr) => {
    for (let i = 0; i < prefixItemsArr.length; i++) {
      if (instanceArr[i] === undefined || instanceArr[i] === null) {
        if (prefixItemsArr[i].default) {
          instanceArr[i] = prefixItemsArr[i].default;
        } else return instanceArr;
      }
      new SchemaDefaults().addDefaults(prefixItemsArr[i], instanceArr[i]);
    }
    return instanceArr;
  };
}

// FOR TESTING PURPOSE -This section will be removed later.
// const schema = {
//   $id: "https://example.com/6",
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   type: "object",
//   properties: {
//     foo: {
//       $ref: "#/$defs/foo",
//       default: true,
//     },
//   },
//   $defs: {
//     foo: {
//       default: 42,
//     },
//   },
// };

// const instance = {};
// const result = await new JsonSchemaProcessor(
//   schema,
//   instance,
//   "-0"
// ).addDefaultsToinstance();
// console.log(result);
