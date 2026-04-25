class BaseError extends Error {
  status: number;
  errors: string;
  constructor(status: number, message: string, errors: string) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
  static UnauthorizedError() {
    return new BaseError(401, "User is not authorized!", "Unauthorized!");
  }
  static badRequest(message: string, errors: string) {
    return new BaseError(400, message, errors);
  }
}
export default BaseError;
