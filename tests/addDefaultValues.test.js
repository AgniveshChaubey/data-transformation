/* eslint-disable no-undef */
import { addDefaultValues } from "../utilities/addDefaultValues.js";
import tests from "./test-add-default-values.json";

tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.name}`, () => {
    try {
      const result = addDefaultValues(eachTest.schema, eachTest.document);
      expect(result).toEqual(eachTest.expected);
    } catch (error) {
      expect(() => log(eachTest.document, eachTest.schema)).toThrow();
    }
  });
});
