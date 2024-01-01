/* eslint-disable no-undef */
import { addDefaultValues } from "../utilities/addDefaultValues.js";
import tests from "./test-add-default-values.json";

tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.name}`, () => {
    const result = addDefaultValues(eachTest.schema, eachTest.document);
    const expected = JSON.parse(JSON.stringify(eachTest.expected));
    expect(result).toEqual(expected);
  });
});
