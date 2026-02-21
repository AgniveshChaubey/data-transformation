import { expect, test } from "vitest";
import { removeExtraPropertiesFromInstance } from "../index.js";
import testData from "./tests.json";

testData.forEach((testObj, i) => {
  testObj.tests.forEach((eachTest, index) => {
    test(`II. Running test ${i}-${index + 1}: ${eachTest.description}`, async () => {
      try {
        const result = await removeExtraPropertiesFromInstance(testObj.schema, eachTest.instance);
        expect(result).toEqual(eachTest.expected);
      } catch (error) {
        expect(error.message).toEqual(eachTest.expected);
      }
    });
  });
});
