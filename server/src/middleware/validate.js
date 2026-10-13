// zod schema ke saath body validate karta hai; fail par 400 + field-wise errors
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'body';
        if (!fields[key]) fields[key] = issue.message;
      }
      return res.status(400).json({ error: 'Validation failed', fields });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
