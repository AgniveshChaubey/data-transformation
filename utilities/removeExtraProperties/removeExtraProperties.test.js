import { expect, test } from "vitest";
import { removeExtraProperties } from "./removeExtraProperties";
import testData from "./tests.json";

testData.tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.description}`, () => {
    const result = removeExtraProperties(testData.schema, eachTest.instance);
    expect(result).toEqual(eachTest.expected);
  });
});
