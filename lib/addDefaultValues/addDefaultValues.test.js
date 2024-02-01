import { expect, test } from "vitest";
import { JsonSchemaProcessor } from "./addDefaultValues";
import testData from "./tests.json";

testData.forEach((testObj, i) => {
  testObj.tests.forEach((eachTest, index) => {
    test(`Running test ${i + 1}-${index + 1}: ${
      eachTest.description
    }`, async () => {
      const schemaProcessor = new JsonSchemaProcessor(
        testObj.schema,
        eachTest.instance,
        `-${index + 1}`
      );
      const result = await schemaProcessor.addDefaultsToinstance();
      expect(result).toEqual(eachTest.expected);
    });
  });
});
