const AsyncHandler = (requestHandler) => {
  return (req, res, next) =>
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
};

// const AsyncHandler = (func) => async (req, res, next) => {
//   try {
//     await func(req, res, next);
//   } catch (error) {
//     console.error(error);
//     next(error);
//   }
// };

export { AsyncHandler };
