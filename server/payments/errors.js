export class PaymentError extends Error {
  constructor(code, status = 409) { super(code); this.status = status; }
}
