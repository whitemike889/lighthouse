module.exports = function ExpectedError(error) {
  if (!(error instanceof Error)) {
    error = new Error(error);
  }

  error.expected = true;
  return error;
};
