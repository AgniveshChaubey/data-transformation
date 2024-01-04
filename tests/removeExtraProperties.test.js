import { expect, test } from "vitest";
import { removeExtraProperties } from "../utilities/removeExtraProperties.js";
import testData from "./test-remove-extra-properties.json";

testData.tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.description}`, () => {
    const result = removeExtraProperties(testData.schema, eachTest.instance);
    expect(result).toEqual(eachTest.expected);
  });
});
