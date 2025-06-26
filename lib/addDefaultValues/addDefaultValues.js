import { registerSchema, unregisterSchema, FLAG } from "@hyperjump/json-schema/draft-2020-12";
import { compile, getSchema, Validation } from "@hyperjump/json-schema/experimental";
import { toAbsoluteIri } from "@hyperjump/uri";
import * as Instance from "@hyperjump/json-schema/instance/experimental";


export const addDefaultsToInstance = async (schema, instance) => {
  const coveredPropertiesMap = {}; // @type {{ [parentSchemaUri: string]: string[] }}
  const coveredItemsMap = {}; // @type {{ [parentSchemaUri: string]: number[] }}
  const schemaId = schema.$id;

  try {    
    registerSchema(schema, schemaId);
    const schemaDocument = await getSchema(schemaId);
    const { ast, schemaUri } = await compile(schemaDocument);
    return evaluateSchema(schemaUri, instance, ast, {}, coveredPropertiesMap, coveredItemsMap);
  } finally {
    unregisterSchema(schemaId);
  }
}; 

const evaluateSchema = (schemaUri, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
  if (typeof ast[schemaUri] !== "boolean") {
    dynamicAnchors = { ...ast.metaData[toAbsoluteIri(schemaUri)].dynamicAnchors, ...dynamicAnchors };
    const sortedAST = sortKeywords(ast[schemaUri]);
    for (const [keywordId, , keywordValue] of sortedAST) {
      const handler = getKeywordHandler(keywordId);
      instance = handler(keywordValue, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
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
  let valueAtLastIndex;

  if (typeof nodes === "boolean") return result;
  for (const node of nodes) {
    if (node[0] === "https://json-schema.org/keyword/default") {
      result.unshift(node);
    } else if (node[0] === "https://json-schema.org/keyword/unevaluatedProperties" || node[0] === "https://json-schema.org/keyword/unevaluatedItems") {
      valueAtLastIndex = node;
    } else {
      result.push(node);
    }
  }

  if (valueAtLastIndex) {
    result.push(valueAtLastIndex);
  }

  return result;
};

const getParentSchema = (uri, keyword) => {
  const search = `/${keyword}`;
  const index = uri.lastIndexOf(search);
  if (index === -1) {
    return uri;
  }
  return uri.slice(0, index);
};

const keywordHandlers = {
  
  // Core
  "https://json-schema.org/keyword/dynamicRef": (dynamicAnchor, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (!(dynamicAnchor in dynamicAnchors)) {
      throw Error(`No dynamic anchor found for "${dynamicAnchor}"`);
    }
    return evaluateSchema(dynamicAnchors[dynamicAnchor], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
  },
  "https://json-schema.org/keyword/draft-2020-12/dynamicRef": ([id, fragment, ref], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (fragment in ast.metaData[id].dynamicAnchors) {
      dynamicAnchors = { ...ast.metaData[id].dynamicAnchors, ...dynamicAnchors };
      return evaluateSchema(dynamicAnchors[fragment], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
    } else {
      return evaluateSchema(ref, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap, coveredPropertiesMap, coveredItemsMap);
    }
  },
  "https://json-schema.org/keyword/ref": (ref, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    return evaluateSchema(ref, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
  },
  "https://json-schema.org/keyword/comment": (_keywordValue, instance) => instance,
  "https://json-schema.org/keyword/definitions": (_keywordValue, instance) => instance,

  // Applicator
  "https://json-schema.org/keyword/allOf": (allOf, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    for (const schema of allOf) {
      instance = evaluateSchema(schema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
    }
    return instance;
  },
  "https://json-schema.org/keyword/anyOf": (anyOf, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    for (const schema of anyOf) {
      const instanceWithDefaults = evaluateSchema(schema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
      if (Validation.interpret(schema, Instance.fromJs(instanceWithDefaults), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG })) {
        instance = instanceWithDefaults;
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/oneOf": (oneOf, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    for (const schema of oneOf) {
      const validationResult = instance ? Validation.interpret(schema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG }) : false;
      instance = evaluateSchema(schema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);

      if (validationResult) return instance;
    }
    return instance;
  },
  "https://json-schema.org/keyword/if": (ifSchema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    const instanceCopy = JSON.parse(JSON.stringify(instance));
    const instanceWithDefaults = evaluateSchema(ifSchema, instanceCopy, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });  
    return validationResult ? instanceWithDefaults : instance;
  },
  "https://json-schema.org/keyword/then": ([ifSchema, thenSchema], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    // const instanceCopy = JSON.parse(JSON.stringify(instance));
    // const instanceWithDefaults = evaluateSchema(ifSchema, instanceCopy, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
    return validationResult ? evaluateSchema(thenSchema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) : instance;
  },
  "https://json-schema.org/keyword/else": ([ifSchema, elseSchema], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    // const instanceCopy = JSON.parse(JSON.stringify(instance));
    // const instanceWithDefaults = evaluateSchema(ifSchema, instanceCopy, ast, dynamicAnchors);
    const validationResult = Validation.interpret(ifSchema, Instance.fromJs(instance), { ast, dynamicAnchors, errors: [], annotations: [], outputFormat: FLAG });
    return !validationResult ? evaluateSchema(elseSchema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) : instance;
  },
  "https://json-schema.org/keyword/properties": (properties, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    properties = JSON.parse(JSON.stringify(properties));
    if (isObject(instance)) {
      for (const propertyName in properties) {
        const value = evaluateSchema(properties[propertyName], instance[propertyName], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
        if (value !== undefined) {
          instance[propertyName] = value;

          const parentSchema = getParentSchema(properties[propertyName], "properties");
          if (parentSchema in coveredPropertiesMap) {
            coveredPropertiesMap[parentSchema].push(propertyName);
          } else {
            coveredPropertiesMap[parentSchema] = [propertyName];
          }
        }
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/additionalProperties": ([isDefinedProperty, additionalProperties], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (isObject(instance)) {
      for (const propertyName in instance) {
        if (!isDefinedProperty.test(propertyName)) {
          instance[propertyName] = evaluateSchema(additionalProperties, instance[propertyName], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);

          const parentSchema = getParentSchema(additionalProperties, "additionalProperties");
          if (parentSchema in coveredPropertiesMap) {
            coveredPropertiesMap[parentSchema].push(propertyName);
          } else {
            coveredPropertiesMap[parentSchema] = [propertyName];
          }
        }
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/patternProperties": (patternProperties, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    const instanceCopy = JSON.parse(JSON.stringify(instance));
    if (isObject(instance)) {
      for (const propertyName in instanceCopy) {
        for (const [pattern, property] of patternProperties) {
          if (pattern.test(propertyName)) {
            instanceCopy[propertyName] = evaluateSchema(property, instanceCopy[propertyName], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);

            const parentSchema = getParentSchema(property, "patternProperties");
            if (parentSchema in coveredPropertiesMap) {
              coveredPropertiesMap[parentSchema].push(propertyName);
            } else {
              coveredPropertiesMap[parentSchema] = [propertyName];
            }
          }
        }
      }
    }
    return instanceCopy;
  },
  "https://json-schema.org/keyword/dependentSchemas": (dependentSchemas, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (isObject(instance)) {
      for (const [ propertyName, propertySchema ] of dependentSchemas) {
        if (propertyName in instance) {
          instance = evaluateSchema(propertySchema, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
        }
      }
    }
    return instance;
  },
  // eslint-disable-next-line no-unused-vars
  "https://json-schema.org/keyword/contains": ({contains, minContains, maxContains }, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (Array.isArray(instance)) {
      for (const [index, item] of instance.entries()) {
        const instanceWithDefaults = evaluateSchema(contains, item, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
        instance[index] = instanceWithDefaults;

        const parentSchema = getParentSchema(contains, "contains");
        if (parentSchema in coveredItemsMap) {
          coveredItemsMap[parentSchema].push(index);
        } else {
          coveredItemsMap[parentSchema] = [index];
        }
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/items": ([numberOfPrefixItems, items], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (Array.isArray(instance)) {
      for (let i = numberOfPrefixItems; i < instance.length; i++) {
        const instanceWithDefaults = evaluateSchema(items, instance[i], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
        instance[i] = instanceWithDefaults;

        const parentSchema = getParentSchema(items, "items");
        if (parentSchema in coveredItemsMap) {
          coveredItemsMap[parentSchema].push(i);
        } else {
          coveredItemsMap[parentSchema] = [i];
        }
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/prefixItems": (prefixItems, instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (Array.isArray(instance)) {
      for (const [index, prefixItem] of prefixItems.entries()) {
        const value = evaluateSchema(prefixItem, instance[index], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
        if (value !== undefined) {
          instance[index] = value;

          const parentSchema = getParentSchema(prefixItem, "prefixItems");
          if (parentSchema in coveredItemsMap) {
            coveredItemsMap[parentSchema].push(index);
          } else {
            coveredItemsMap[parentSchema] = [index];
          }
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

  // Unevaluated
  "https://json-schema.org/keyword/unevaluatedProperties": ([parentSchema, unevaluatedProperties], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (isObject(instance)) {
      const coveredProperties = [];
      for (const key in coveredPropertiesMap) {
        if (key.includes(parentSchema)) {
          coveredProperties.push(...coveredPropertiesMap[key]);
        }
      }
      for (const propertyName in instance) {
        if (!coveredProperties.includes(propertyName)) {
          const value = evaluateSchema(unevaluatedProperties, instance[propertyName], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
          instance[propertyName] = value;

          const parentSchema = getParentSchema(unevaluatedProperties, "unevaluatedProperties");
          if (parentSchema in coveredPropertiesMap) {
            coveredPropertiesMap[parentSchema].push(propertyName);
          } else {
            coveredPropertiesMap[parentSchema] = [propertyName];
          }
        }
      }
    }
    return instance;
  },
  "https://json-schema.org/keyword/unevaluatedItems": ([parentSchema, unevaluatedItems], instance, ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap) => {
    if (Array.isArray(instance)) {
      const coveredItems = [];
      for (const key in coveredItemsMap) {
        if (key.includes(parentSchema)) {
          coveredItems.push(...coveredItemsMap[key]);
        }
      }
      for (const [index, _] of instance.entries()) {
        if (!coveredItems.includes(index)) {
          const instanceWithDefaults = evaluateSchema(unevaluatedItems, instance[index], ast, dynamicAnchors, coveredPropertiesMap, coveredItemsMap);
          instance[index] = instanceWithDefaults;
          
          const parentSchema = getParentSchema(unevaluatedItems, "unevaluatedItems");
          if (parentSchema in coveredItemsMap) {
            coveredItemsMap[parentSchema].push(index);
          } else {
            coveredItemsMap[parentSchema] = [index];
          }
        }
      }
    }
    return instance;
  }
};
