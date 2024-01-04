import { expect, test } from "vitest";
import { convertFormQueryString } from "../utilities/convertFormQueryString";
import testData from "./test-convert-form-query-string.json";

testData.tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.description}`, () => {
    const result = convertFormQueryString(
      testData.schema,
      eachTest.queryString
    );
    expect(result).toEqual(eachTest.expected);
  });
});
