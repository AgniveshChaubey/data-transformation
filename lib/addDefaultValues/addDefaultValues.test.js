import { expect, test } from "vitest";
import { addDefaultsToInstance } from "../index.js";
import testData from "./tests.json";

testData.forEach((testObj, i) => {
  testObj.tests.forEach((eachTest, index) => {
    test(`Running test ${i}-${index + 1}: ${
      eachTest.description
    }`, async () => {
      try {
        const result = await addDefaultsToInstance(testObj.schema, eachTest.instance);
        console.log(444444444, testObj.schema, eachTest.instance, result);
        expect(result).toEqual(eachTest.expected);
      } catch (error) {
        expect(error.message).toEqual(eachTest.expected);
      }
    });
  });
});
