import { expect, test } from "vitest";
import { addDefaultValuesToDocument } from "../utilities/addDefaultValues.js";
import testData from "./test-add-default-values.json";

testData.forEach((testObj) => {
  testObj.tests.forEach((eachTest, index) => {
    test(`Running test ${index + 1}: ${eachTest.description}`, () => {
      const result = addDefaultValuesToDocument(
        testObj.schema,
        eachTest.instance
      );
      expect(result).toEqual(eachTest.expected);
    });
  });
});
