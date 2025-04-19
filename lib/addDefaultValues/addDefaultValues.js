import { registerSchema, unregisterSchema } from "@hyperjump/json-schema/draft-2020-12";
import { compile, getSchema } from "@hyperjump/json-schema/experimental";
import { toAbsoluteIri } from "@hyperjump/uri";

// let evalCount = 0;
export class JsonSchemaProcessor {
  constructor(schema, instance) {
    this.schema = schema;
    this.instance = instance;
  }

  addDefaultsToInstance = async () => {

    const schemaId = this.schema.$id;
    try {    
      registerSchema(this.schema, schemaId);
      const schemaDocument = await getSchema(schemaId);
      const { ast, schemaUri } = await compile(schemaDocument);
      // console.log("SchemaUri: ", schemaUri);
      // console.log("AST: ", ast);
      return evaluateSchema(schemaUri, this.instance, ast, {});
    } finally {
      unregisterSchema(schemaId);
    }
  }; 
}

const evaluateSchema = (schemaUri, instance, ast, dynamicAnchors) => {
  // console.log("EvalCount: ", evalCount++);
  if (typeof ast[schemaUri] !== "boolean") {
    dynamicAnchors = { ...ast.metaData[toAbsoluteIri(schemaUri)].dynamicAnchors, ...dynamicAnchors };

    // for (const [ keywordId, , keywordValue ] of sortKeywords(ast[schemaUri])) {
    for (const [keywordId, , keywordValue] of ast[schemaUri]) {
      // console.log("Keyword Value 1: ", keywordValue, " ")
      // keywordValue = JSON.parse(JSON.stringify(keywordValue));
      // console.log("Keyword Value 2: ", keywordValue, " ")
      const handler = getKeywordHandler(keywordId);

      // console.log("Handler: ", handler);
      // console.log("KeywordValue: ", keywordValue);
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

const keywordHandlers = {
  "https://json-schema.org/keyword/properties": (properties, instance, ast, dynamicAnchors) => {
    // console.log("Prop Handler: ", properties, instance, ast);
    // console.log("properties 1: ", properties)
    // properties = JSON.parse(JSON.stringify(properties));
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
  "https://json-schema.org/keyword/default": (defaultValue, instance) => {
    return instance === undefined ? defaultValue : instance;
  },

};

// FOR TESTING PURPOSE -This section will be removed later.
// const schema = {
//   $id: "https://example.com/8",
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   // required: ["aaa", "bbb"],
//   properties: {
//     ccc: { default: "foo" },
//   },
//   default: "Agnivesh"
// };

// const instance = {
//   aaa: 42,
//   ccc: 42
// };
// const result = await new JsonSchemaProcessor(
//   schema,
//   instance
// ).addDefaultsToInstance();
// console.log(result);