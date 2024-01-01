/* eslint-disable no-undef */
import { removeExtraProperties } from "../utilities/removeExtraProperties.js";
import tests from "./test-remove-extra-properties.json";

tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.name}`, () => {
    const result = removeExtraProperties(eachTest.schema, eachTest.document);
    const expected = JSON.parse(JSON.stringify(eachTest.expected));
    expect(result).toEqual(expected);
  });
});
