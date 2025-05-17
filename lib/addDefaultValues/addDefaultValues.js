import { registerSchema, unregisterSchema, FLAG } from "@hyperjump/json-schema/draft-2020-12";
import { compile, getSchema, Validation } from "@hyperjump/json-schema/experimental";
import { toAbsoluteIri } from "@hyperjump/uri";
import * as Instance from "@hyperjump/json-schema/instance/experimental";

export const addDefaultsToInstance = async (schema, instance) => {
  const schemaId = schema.$id;
  try {    
    registerSchema(schema, schemaId);
    const schemaDocument = await getSchema(schemaId);
    const { ast, schemaUri } = await compile(schemaDocument);
    return evaluateSchema(schemaUri, instance, ast, {});
  } finally {
    unregisterSchema(schemaId);
  }
}; 

const evaluateSchema = (schemaUri, instance, ast, dynamicAnchors) => {
  if (typeof ast[schemaUri] !== "boolean") {
    dynamicAnchors = { ...ast.metaData[toAbsoluteIri(schemaUri)].dynamicAnchors, ...dynamicAnchors };
    const sortedAST = sortKeywords(ast[schemaUri]);
    for (const [keywordId, , keywordValue] of sortedAST) {
      const handler = getKeywordHandler(keywordId);
      instance = handler(keywordValue, instance, ast, dynamicAnchors);
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
  
  // Core
  "https://json-schema.org/keyword/dynamicRef": (dynamicAnchor, instance, ast, dynamicAnchors) => {
    if (!(dynamicAnchor in dynamicAnchors)) {
      throw Error(`No dynamic anchor found for "${dynamicAnchor}"`);
    }
    return evaluateSchema(dynamicAnchors[dynamicAnchor], instance, ast, dynamicAnchors);
  },
  "https://json-schema.org/keyword/draft-2020-12/dynamicRef": ([id, fragment, ref], instance, ast, dynamicAnchors) => {
    if (fragment in ast.metaData[id].dynamicAnchors) {
      dynamicAnchors = { ...ast.metaData[id].dynamicAnchors, ...dynamicAnchors };
      return evaluateSchema(dynamicAnchors[fragment], instance, ast, dynamicAnchors);
    } else {
      return evaluateSchema(ref, instance, ast, dynamicAnchors);
    }
  },
  "https://json-schema.org/keyword/ref": (ref, instance, ast, dynamicAnchors) => {
    return evaluateSchema(ref, instance, ast, dynamicAnchors);
  },
  "https://json-schema.org/keyword/comment": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/definitions": (_keywordValue, instance) => instance,

  // Applicator
  "https://json-schema.org/keyword/allOf": (allOf, instance, ast, dynamicAnchors) => {
    for (const schema of allOf) {
      instance = evaluateSchema(schema, instance, ast, dynamicAnchors);
    }
    return instance;
  },
  "https://json-schema.org/keyword/anyOf": (anyOf, instance, ast, dynamicAnchors) => {
    for (const schema of anyOf) {
      const instanceWithDefaults = evaluateSchema(schema, instance, ast, dynamicAnchors);
      if (Validation.interpret(schema, Instance.fromJs(instanceWithDefaults), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG })) {
        instance = instanceWithDefaults;
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/oneOf": (oneOf, instance, ast, dynamicAnchors) => {
    for (const schema of oneOf) {
      const validationResult = instance ? Validation.interpret(schema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG }) : false;
      instance = evaluateSchema(schema, instance, ast, dynamicAnchors);

      if (validationResult) return instance;
    }
    return instance;
  },
  "https://json-schema.org/keyword/if": (ifSchema, instance, ast, dynamicAnchors) => {
    const instanceCopy = JSON.parse(JSON.stringify(instance));
    const instanceWithDefaults = evaluateSchema(ifSchema, instanceCopy, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });  
    return validationResult ? instanceWithDefaults : instance;
  },
  "https://json-schema.org/keyword/then": ([ifSchema, thenSchema], instance, ast, dynamicAnchors) => {
    // const instanceCopy = JSON.parse(JSON.stringify(instance));
    // const instanceWithDefaults = evaluateSchema(ifSchema, instanceCopy, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
    return validationResult ? evaluateSchema(thenSchema, instance, ast, dynamicAnchors) : instance;
  },
  "https://json-schema.org/keyword/else": ([ifSchema, elseSchema], instance, ast, dynamicAnchors) => {
    // const instanceCopy = JSON.parse(JSON.stringify(instance));
    // const instanceWithDefaults = evaluateSchema(ifSchema, instanceCopy, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
    return !validationResult ? evaluateSchema(elseSchema, instance, ast, dynamicAnchors) : instance;
  },
  "https://json-schema.org/keyword/properties": (properties, instance, ast, dynamicAnchors) => {
    properties = JSON.parse(JSON.stringify(properties));
    if (isObject(instance)) {
      for (const propertyName in properties) {
        const value = evaluateSchema(properties[propertyName], instance[propertyName], ast, dynamicAnchors);
        if (value !== undefined) {
          instance[propertyName] = value;
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
  "https://json-schema.org/keyword/patternProperties": (patternProperties, instance, ast, dynamicAnchors) => {
    const instanceCopy = JSON.parse(JSON.stringify(instance));
    if (isObject(instance)) {
      for (const propertyName in instanceCopy) {
        for (const [pattern, property] of patternProperties) {
          if (pattern.test(propertyName)) {
            instanceCopy[propertyName] = evaluateSchema(property, instanceCopy[propertyName], ast, dynamicAnchors);
          }
        }
      }
    }
    return instanceCopy;
  },
  "https://json-schema.org/keyword/dependentSchemas": (dependentSchemas, instance, ast, dynamicAnchors) => {
    if (isObject(instance)) {
      for (const [ propertyName, propertySchema ] of dependentSchemas) {
        if (propertyName in instance) {
          instance = evaluateSchema(propertySchema, instance, ast, dynamicAnchors);
        }
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
  "https://json-schema.org/keyword/items": ([numberOfPrefixItems, items], instance, ast, dynamicAnchors) => {
    if (Array.isArray(instance)) {
      for (let i = numberOfPrefixItems; i < instance.length; i++) {
        const instanceWithDefaults = evaluateSchema(items, instance[i], ast, dynamicAnchors);
        instance[i] = instanceWithDefaults;
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
  "https://json-schema.org/keyword/not": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/propertyNames": (_keywordValue, instance) => instance,

  // Validation
  "https://json-schema.org/keyword/type": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/enum": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/const": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/maxLength": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/minLength": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/pattern": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/exclusiveMaximum": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/exclusiveMinimum": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/maximum": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/minimum": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/multipleOf": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/dependentRequired": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/maxProperties": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/minProperties": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/required": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/maxItems": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/minItems": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/maxContains": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/minContains": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/uniqueItems": (_keywordValue, instance) => instance,
  
  // Meta Data
  "https://json-schema.org/keyword/default": (defaultValue, instance) => {
    return instance === undefined ? defaultValue : instance;
  },
  "https://json-schema.org/keyword/title": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/description": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/deprecated": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/examples": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/readOnly": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/writeOnly": (_keywordValue, instance) => instance,
  
  // Format Annotation
  "https://json-schema.org/keyword/format": (_keywordValue, instance) => instance,
  
  // Format Assertion
  "https://json-schema.org/keyword/format-assertion": (_keywordValue, instance) => instance,
  
  // Content
  "https://json-schema.org/keyword/contentEncoding": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/contentMediaType": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/contentSchema": (_keywordValue, instance) => instance,

  // Unknown keywords
  "https://json-schema.org/keyword/unknown": (unknown, instance) => instance,
};

// FOR TESTING PURPOSE -This section will be removed later.
const schema = {
  "$id": "https://example.com",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$ref": "main",
  "$defs": {
    "foo": {
      "$id": "default",
      "$dynamicAnchor": "default",
      "default": 42
    },
    "main": {
      "$id": "main",
      "type": "object",
      "properties": {
        "foo": { "$dynamicRef": "default" }
      }
    }
  }
};

const instance = {
  // aaa: { foo: 55},
  // afoo: { bar: 222, foo: false}
};

// const result = await addDefaultsToInstance(schema, instance);
// console.log(result);