function success(res, data, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function error(res, message = "Error", statusCode = 400, errors = null) {
  const body = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

function paginated(res, data, pagination, message = "Success") {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  });
}

function created(res, data, message = "Created") {
  return success(res, data, message, 201);
}

function notFound(res, message = "Resource not found") {
  return error(res, message, 404);
}

function unauthorized(res, message = "Unauthorized") {
  return error(res, message, 401);
}

function forbidden(res, message = "Forbidden") {
  return error(res, message, 403);
}

function serverError(res, message = "Internal server error") {
  return error(res, message, 500);
}

module.exports = { success, error, paginated, created, notFound, unauthorized, forbidden, serverError };
