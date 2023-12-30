import Ajv from "ajv";
const ajv = new Ajv();

const schema = {
  $id: "https://github.com/AgniveshChaubey",
  type: "object",
  properties: {
    name: { type: "string", default: "Raju" },
    age: { type: "string", default: "20" },
    address: {
      type: "object",
      properties: {
        state: { type: "string" },
        country: { type: "string" },
        pincode: { type: "number" },
      },
    },
    phone: { type: "number", default: 1111111111 },
  },
};

const document = {
  name: "Agnivesh",
  address: {
    city: "Anand",
    state: "Gujarat",
    country: "India",
    pincode: 396191,
  },
};

const addDefaultValues = (schema, document) => {
  const isValid = ajv.validate(schema, document);
  if (!isValid) {
    console.log("Instance is invalid :-(");
  } else console.log("Instance is valid :-)");

  console.log(document);
  const addDefauls = (schema, doc) => {
    if (typeof schema === "object" && !Array.isArray(schema)) {
      for (const key in schema.properties) {
        if (
          doc[key] === undefined &&
          schema.properties[key].default !== undefined
        ) {
          doc[key] = schema.properties[key].default;
        } else if (
          typeof schema.properties[key] === "object" &&
          !Array.isArray(schema.properties[key])
        ) {
          addDefauls(schema.properties[key], doc[key]);
        }
      }
    }
  };

  addDefauls(schema, document);
  console.log(document);
  return document;
};

addDefaultValues(schema, document);

export default addDefaultValues;
