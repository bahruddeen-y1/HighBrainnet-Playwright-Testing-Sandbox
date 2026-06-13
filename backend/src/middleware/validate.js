// Wraps a Zod schema as Express middleware. Supports body | query | params.
module.exports = function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    req[source] = result.data;
    next();
  };
};
