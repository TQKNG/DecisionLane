"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { formatAmount } from "@/features/claims/format";
import { useCreateTestOrderMutation } from "@/features/operations/api";
import { EMPTY_ORDER_FORM, ORDER_ID_MAX_LENGTH, toCreateOrderRequest, validateOrderForm, type OrderFormErrors, type OrderFormValues } from "@/features/operations/order-form";
import { isApiError } from "@/lib/api/base-query";
import styles from "./operations.module.css";

export function TestOrderForm() {
    const [values, setValues] = useState<OrderFormValues>(EMPTY_ORDER_FORM);
    const [errors, setErrors] = useState<OrderFormErrors>({});
    const [createOrder, { data: created, error, isLoading, reset }] = useCreateTestOrderMutation();

    function update(field: keyof OrderFormValues, value: string) {
        setValues({ ...values, [field]: value });
        if (created || error) reset();
    }

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextErrors = validateOrderForm(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;
        const result = await createOrder(toCreateOrderRequest(values));
        if (!("error" in result)) setValues(EMPTY_ORDER_FORM);
    }

    return <Card className={styles.section} aria-labelledby="test-order-title">
        <div className={styles.sectionHead}><h2 id="test-order-title">Create a test order</h2><Badge variant="warning">Test tooling</Badge></div>
        <p className={styles.muted}>Adds an order record so a customer can file a claim against it in non-production testing. Real orders come from the payment integration.</p>
        <form className={styles.orderForm} onSubmit={(event) => void submit(event)} noValidate>
            <Field label="Order ID" maxLength={ORDER_ID_MAX_LENGTH} value={values.id} error={errors.id} disabled={isLoading} onChange={(event) => update("id", event.target.value)} />
            <Field label="Customer object ID" help="The customer's Microsoft Entra object ID." value={values.customer_id} error={errors.customer_id} disabled={isLoading} onChange={(event) => update("customer_id", event.target.value)} />
            <Field label="Currency" maxLength={3} value={values.currency} error={errors.currency} disabled={isLoading} onChange={(event) => update("currency", event.target.value)} />
            <Field label="Amount paid" inputMode="decimal" value={values.paid_amount} error={errors.paid_amount} disabled={isLoading} onChange={(event) => update("paid_amount", event.target.value)} />
            <Field label="Payment reference" help="A Stripe test-mode payment intent ID." value={values.payment_intent_id} error={errors.payment_intent_id} disabled={isLoading} onChange={(event) => update("payment_intent_id", event.target.value)} />
            <div className={styles.formFooter}>
                {created && <Notice variant="success">Order {created.id} was created for {formatAmount(created.paid_amount, created.currency)}.</Notice>}
                {error && <Notice variant="destructive">{isApiError(error) ? error.detail : "We could not create the order. Please try again."}</Notice>}
                <Button type="submit" disabled={isLoading}>{isLoading ? "Creating..." : "Create order"}</Button>
            </div>
        </form>
    </Card>;
}
