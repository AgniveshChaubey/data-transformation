import { registerSchema, unregisterSchema, validate } from "@hyperjump/json-schema";
import { compile, getSchema } from "@hyperjump/json-schema/experimental";

export class ParseAndValidateSchema {
  static validate = async (schema, instance) => {
    try {
      const schemaId = schema.$id;
      registerSchema(schema, schemaId);
      // const schemaDocument = await getSchema(schemaId);
      // const { ast, schemaUri } = await compile(schemaDocument);
      // console.log(JSON.stringify(ast, null, "  "));
      const result = await validate(schemaId, instance);
      return { schema, result };
      
    } catch (error) {
      throw Error("Invalid Schema", { cause: error });
    }
  };
}

export const generateAST = async (schema) => {
  const schemaId = schema.$id;
  // unregisterSchema(schemaId)
  registerSchema(schema, schemaId);
  const result = await validate(schemaId, {});
  const schemaDocument = await getSchema(schemaId);
  const { ast, schemaUri } = await compile(schemaDocument);
  console.log(schemaId, schemaUri, ast);
  // return result;
}

export const dataType = (schema) => {
  if (schema.properties || schema.additionalProperties) {
    return "object";
  }

  if (schema.prefixItems || schema.items || schema.contains) {
    return "array";
  }

  return schema.type || typeof schema.default;
};

export const resolveRef = (ref, schema) => {
  const parts = ref.split("/");
  let node = schema;
  for (let i = 1; i < parts.length; i++) {
    node = node[parts[i]];
  }
  return node;
};
