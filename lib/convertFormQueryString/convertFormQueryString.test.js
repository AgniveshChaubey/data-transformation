import { expect, test } from "vitest";
import { convertFormQueryString } from "./convertFormQueryString";
import testData from "./tests.json";

testData.tests.forEach((eachTest, index) => {
  test(`Running test ${index + 1}: ${eachTest.description}`, () => {
    const result = convertFormQueryString(
      testData.schema,
      eachTest.queryString
    );
    expect(result).toEqual(eachTest.expected);
  });
});
