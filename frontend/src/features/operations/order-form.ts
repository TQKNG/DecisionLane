import type { CreateOrderRequest } from "@/features/operations/types";

// Limits mirror CreateOrderRequest in backend/api/routers/orders.py.
export const ORDER_ID_MAX_LENGTH = 100;

export type OrderFormValues = { [Key in keyof CreateOrderRequest]: string };
export type OrderFormErrors = Partial<Record<keyof OrderFormValues, string>>;

export const EMPTY_ORDER_FORM: OrderFormValues = { id: "", customer_id: "", currency: "CAD", paid_amount: "", payment_intent_id: "" };

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

export function validateOrderForm(values: OrderFormValues): OrderFormErrors {
    const errors: OrderFormErrors = {};
    const id = values.id.trim();
    const amount = values.paid_amount.trim();
    if (!id) errors.id = "Enter an order ID.";
    else if (id.length > ORDER_ID_MAX_LENGTH) errors.id = `Order IDs are at most ${ORDER_ID_MAX_LENGTH} characters.`;
    if (!values.customer_id.trim()) errors.customer_id = "Enter the customer's Entra object ID.";
    if (!CURRENCY_PATTERN.test(values.currency.trim())) errors.currency = "Enter a three-letter currency code, such as CAD.";
    if (!amount) errors.paid_amount = "Enter the amount paid.";
    else if (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) errors.paid_amount = "Enter an amount greater than 0 with up to two decimal places.";
    if (!values.payment_intent_id.trim()) errors.payment_intent_id = "Enter the payment provider reference.";
    return errors;
}

export function toCreateOrderRequest(values: OrderFormValues): CreateOrderRequest {
    return {
        id: values.id.trim(),
        customer_id: values.customer_id.trim(),
        currency: values.currency.trim().toUpperCase(),
        paid_amount: values.paid_amount.trim(),
        payment_intent_id: values.payment_intent_id.trim(),
    };
}
