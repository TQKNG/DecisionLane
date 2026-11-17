// API boundary types for Admin endpoints. Field names match backend/openapi/openapi.json.

export interface AdminKpis {
    total_claims: number;
    pending_approval: number;
    refunded: number;
    rejected: number;
    /** Share of claims that reached a final refunded or rejected decision, from 0 to 1. */
    decision_rate: number;
    by_status: Record<string, number>;
}

export interface CreateOrderRequest {
    id: string;
    customer_id: string;
    currency: string;
    paid_amount: string;
    payment_intent_id: string;
}

export interface OrderRecord {
    id: string;
    customer_id: string;
    currency: string;
    paid_amount: string;
    payment_intent_id: string;
}
