/* eslint-disable no-undef */
import { addDefaultValues } from "../utilities/addDefaultValues.js";
import testData from "./test-add-default-values.json";

testData.tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.description}`, () => {
    const result = addDefaultValues(testData.schema, eachTest.instance);
    expect(result).toEqual(eachTest.expected);
  });
});
