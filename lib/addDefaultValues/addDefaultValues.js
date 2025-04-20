import { registerSchema, unregisterSchema, FLAG } from "@hyperjump/json-schema/draft-2020-12";
import { compile, getSchema, Validation } from "@hyperjump/json-schema/experimental";
import { toAbsoluteIri } from "@hyperjump/uri";
import * as Instance from "@hyperjump/json-schema/instance/experimental";

let evalCount = 0;
export class JsonSchemaProcessor {
  constructor(schema, instance) {
    this.schema = schema;
    this.instance = instance;
  }

  addDefaultsToInstance = async () => {
    // const sortedSchema = sortDefaultsFirst(this.schema);
    const schemaId = schema.$id;
    // console.log("Sorted Schema: ", sortedSchema)
    try {    
      registerSchema(this.schema, schemaId);
      const schemaDocument = await getSchema(schemaId);
      const { ast, schemaUri } = await compile(schemaDocument);
      // console.log("SchemaUri: ", schemaUri);
      // console.log("AST: ", ast);
      // console.log("AST", JSON.stringify(ast, null, 2));
      return evaluateSchema(schemaUri, this.instance, ast, {});
    } finally {
      unregisterSchema(schemaId);
    }
  }; 
}

const evaluateSchema = (schemaUri, instance, ast, dynamicAnchors) => {
  // console.log("EvalCount: ", evalCount++);
  // console.log("Instance: ", instance);
  // console.log("AST: ", (JSON.stringify(ast, null, 2)))
  if (typeof ast[schemaUri] !== "boolean") {
    dynamicAnchors = { ...ast.metaData[toAbsoluteIri(schemaUri)].dynamicAnchors, ...dynamicAnchors };

    // for (const [ keywordId, , keywordValue ] of sortKeywords(ast[schemaUri])) {
    const sortedAST = sortKeywords(ast[schemaUri]);
    // console.log("Sorted AST: ", JSON.stringify(sortedAST,null, 2));
    for (const [keywordId, , keywordValue] of sortedAST) {
      // console.log("Keyword Id: ", keywordId);
      // keywordValue = JSON.parse(JSON.stringify(keywordValue));
      // console.log("Keyword Value 2: ", keywordValue, " ")
      const handler = getKeywordHandler(keywordId);

      // console.log("Handler: ", handler);
      // console.log("KeywordValue: ", keywordValue);
      // console.log("Instance: ", instance);
      // console.log("HandlerValue: ", handler(keywordValue, instance, ast, dynamicAnchors));
      instance = handler(keywordValue, instance, ast, dynamicAnchors);
      // console.log(111111111, handler, instance)
      // console.log(333, keywordEvaluationResult);

      // console.log(10000, instance);
    }
  }
  return instance;
};

const isObject = (value) => typeof value === "object" && !Array.isArray(value) && value !== null;

const getKeywordHandler = (keywordId) => {
  const normalizedKeywordId = toAbsoluteIri(keywordId);
  if (!(normalizedKeywordId in keywordHandlers)) {
    throw Error(`No handler found for Keyword: ${normalizedKeywordId}`);
  }

  return keywordHandlers[normalizedKeywordId];
};

const  sortKeywords = (nodes) => {
  const result = [];

  if (typeof nodes === "boolean") return result;
  for (const node of nodes) {
    if (node[0] === "https://json-schema.org/keyword/default") {
      result.unshift(node);
    } else {
      result.push(node);
    }
  }
  return result;
};


const keywordHandlers = {
  "https://json-schema.org/keyword/properties": (properties, instance, ast, dynamicAnchors) => {
    // console.log("Prop Handler: ", properties, instance, ast);
    // console.log("properties 1: ", properties)
    properties = JSON.parse(JSON.stringify(properties));
    // console.log("properties 2: ", properties)
    // console.log(4444, properties, instance);
    // console.log("isobject", isObject(instance))
    if (isObject(instance)) {
      for (const propertyName in properties) {
        // console.log("propertyName: ", propertyName);
        // console.log("propertyVal: ", properties[propertyName]);
        // console.log("instanceVal: ", instance[propertyName]);
        const value = evaluateSchema(properties[propertyName], instance[propertyName], ast, dynamicAnchors);
        // console.log(5555, value, instance);
        if (value !== undefined) {
          instance[propertyName] = value;
          // console.log(5555, instance, propertyName, value);
        }
      }
    }
    return instance;
  },

  "https://json-schema.org/keyword/additionalProperties": ([isDefinedProperty, additionalProperties], instance, ast, dynamicAnchors) => {
    if (isObject(instance)) {
      for (const propertyName in instance) {
        if (!isDefinedProperty.test(propertyName)) {
          const value = evaluateSchema(additionalProperties, instance[propertyName], ast, dynamicAnchors);
          instance[propertyName] = value;
        }
      }
    }
    return instance;
  },

  "https://json-schema.org/keyword/default": (defaultValue, instance) => {
    return instance === undefined ? defaultValue : instance;
  },
  "https://json-schema.org/keyword/type": (type, instance) => instance,
  
  "https://json-schema.org/keyword/const": (constValue, instance) => instance,
  
  "https://json-schema.org/keyword/required": (required, instance) => instance,

  "https://json-schema.org/keyword/ref": (ref, instance, ast, dynamicAnchors) => {
    // ref = JSON.parse(JSON.stringify(ref));
    // console.log("Ref instance: ", ref, instance)
    return evaluateSchema(ref, instance, ast, dynamicAnchors);
    // return value;
    // )
    // return instance;
  },
  "https://json-schema.org/keyword/definitions": (items, instance) => instance,
  
  "https://json-schema.org/keyword/items": ([numberOfPrefixItems, items], instance, ast, dynamicAnchors) => {
    if (Array.isArray(instance)) {
      for (let i = numberOfPrefixItems; i < instance.length; i++) {
        const instanceWithDefaults = evaluateSchema(items, instance[i], ast, dynamicAnchors);
        instance[i] = instanceWithDefaults;
      }
    }

    return instance;
  },

  "https://json-schema.org/keyword/contains": ({contains, minContains, maxContains }, instance, ast, dynamicAnchors) => {
    if (Array.isArray(instance)) {
      for (const [index, item] of instance.entries()) {
        const instanceWithDefaults = evaluateSchema(contains, item, ast, dynamicAnchors);
        instance[index] = instanceWithDefaults;
      }
    }
    return instance;
  },

  "https://json-schema.org/keyword/prefixItems": (prefixItems, instance, ast, dynamicAnchors) => {
    if (Array.isArray(instance)) {
      for (const [index, prefixItem] of prefixItems.entries()) {
        const value = evaluateSchema(prefixItem, instance[index], ast, dynamicAnchors);
        if (value !== undefined) {
          instance[index] = value;
        }
      }
    }
    
    return instance;
  },

  "https://json-schema.org/keyword/anyOf": (anyOf, instance, ast, dynamicAnchors) => {
    for (const schema of anyOf) {
      instance = evaluateSchema(schema, instance, ast, dynamicAnchors);
    }
    return instance;
  },

  "https://json-schema.org/keyword/oneOf": (oneOf, instance, ast, dynamicAnchors) => {
    for (const schema of oneOf) {
      instance = evaluateSchema(schema, instance, ast, dynamicAnchors);
    }
    return instance;
  },
  "https://json-schema.org/keyword/if": (ifSchema, instance, ast, dynamicAnchors) => {
    // return evaluateSchema(ifSchema, instance, ast, dynamicAnchors);
    const instanceWithDefaults = evaluateSchema(ifSchema, instance, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instanceWithDefaults), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
      
    return validationResult ? instanceWithDefaults : instance;
  },

  "https://json-schema.org/keyword/then": ([ifSchema, thenSchema], instance, ast, dynamicAnchors) => {
    const instanceWithDefaults = evaluateSchema(ifSchema, instance, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instanceWithDefaults), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
    
    return validationResult ? evaluateSchema(thenSchema, instanceWithDefaults, ast, dynamicAnchors) : instance;
  },
  
  "https://json-schema.org/keyword/else": ([ifSchema, elseSchema], instance, ast, dynamicAnchors) => {
    const instanceWithDefaults = evaluateSchema(ifSchema, instance, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instanceWithDefaults), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
    
    return !validationResult ? evaluateSchema(elseSchema, instanceWithDefaults, ast, dynamicAnchors) : instance;
  },
  "https://json-schema.org/keyword/dependentSchemas": (dependentSchemas, instance, ast, dynamicAnchors) => {
    if (isObject(instance)) {
      for (const [ propertyName, propertySchema ] of dependentSchemas) {
        if (instance.hasOwnProperty(propertyName)) {
          instance = evaluateSchema(propertySchema, instance, ast, dynamicAnchors);
        }
      }
    }
    return instance;
  },
};

// FOR TESTING PURPOSE -This section will be removed later.
const schema = {
  "$id": "https://example.com/8",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "foo": {
      "type": "string"
    },
    "bar": {
      "type": "number"
    }
  },
  "propertyDependencies": {
    "foo": {
      "aaa": {
        "properties": {
          "bar": {
            "default": 42
          }
        }
      }
    }
  }
};

const instance = {
  foo: "aaa"
};

// const result = await new JsonSchemaProcessor(
//   schema,
//   instance
// ).addDefaultsToInstance();
// console.log(result);