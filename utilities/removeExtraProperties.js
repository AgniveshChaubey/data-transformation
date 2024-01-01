/* eslint-disable no-prototype-builtins */
import Ajv from "ajv";
const ajv = new Ajv();

export const removeExtraProperties = (schema, document) => {
  console.log(document);
  const isValid = ajv.validate(schema, document);

  if (!isValid) {
    console.log("Instance is invalid :-(");
  } else console.log("Instance is valid :-)");

  const removeExtra = (schema, doc) => {
    if (typeof schema === "object" && !Array.isArray(schema) && schema.properties) {
      for (const key in doc) {
        if (!schema.properties.hasOwnProperty(key)) {
          delete doc[key];
        } else if (
          typeof schema.properties[key] === "object" &&
          !Array.isArray(schema.properties[key])
        ) {
          removeExtra(schema.properties[key], doc[key]);
        }
      }
    }
  };
  removeExtra(schema, document);
  console.log(document);
};

const sc = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
};

const doc = {
  name: "Agnivesh",
  age: 21,
  lastName: "Chaubey",
};

removeExtraProperties(sc, doc);
