export class GatewayUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayUnreachableError";
  }
}

export class GatewayRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GatewayRequestError";
    this.status = status;
  }
}
