import Ajv from "ajv";
const ajv = new Ajv();

export const convertFormQueryString = (schema, queryString) => {
  const urlSearchParams = new URLSearchParams(queryString);
  const resultJson = {};
  console.log(urlSearchParams)

  for (const key in schema.properties) {
    if (urlSearchParams.has(key)) {
      const valueType = schema.properties[key].type;
      let castedValue;

      switch (valueType) {
        case "number":
          castedValue = parseFloat(urlSearchParams.get(key));
          break;
        case "integer":
          castedValue = parseInt(urlSearchParams.get(key));
          break;

        case "boolean":
          castedValue = urlSearchParams.get(key) === "true";
          break;
        default:
          castedValue = urlSearchParams.get(key);
      }
      resultJson[key] = castedValue;
    }
  }
  return resultJson;
};

const schema = {
  properties: {
    foo: { type: "number" },
    bar: { type: "string" },
  },
};

const queryString = "foo=42&bar=hello";

const result = convertFormQueryString(schema, queryString);

console.log(result);
