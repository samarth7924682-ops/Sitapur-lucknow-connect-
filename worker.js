const FIREBASE_URL = "https://sitapur-express-default-rtdb.asia-southeast1.firebasedatabase.app";

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // ─── STATUS CHECK: Polling ke liye ───
    if (url.pathname === "/status") {
      const orderId = url.searchParams.get("order_id");
      const res = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": "12994501ff7180bbe19bd075ece0549921",
          "x-client-secret": "cfsk_ma_prod_f742703303f450c287d56666f95b067e_5f571f6d"
        }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── WEBHOOK ───
    if (url.pathname === "/webhook") {
      try {
        const body = await request.json();
        const orderId = body?.data?.order?.order_id || body?.order_id;
        const paymentStatus = body?.data?.payment?.payment_status || body?.payment_status;

        if (orderId && paymentStatus === "SUCCESS") {
          const pendingRes = await fetch(`${FIREBASE_URL}/pending_orders/${orderId}.json`);
          const pendingOrder = await pendingRes.json();

          if (pendingOrder) {
            const txnId = body?.data?.payment?.cf_payment_id || orderId;
            pendingOrder.transaction_id = String(txnId);
            pendingOrder.payment_status = "SUCCESS";

            await fetch(`${FIREBASE_URL}/parcel_bookings/${orderId}.json`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pendingOrder)
            });

            await fetch(`${FIREBASE_URL}/pending_orders/${orderId}.json`, { method: "DELETE" });
          }
        }
        return new Response("ok", { headers: cors });
      } catch (e) {
        return new Response("webhook error: " + e.message, { status: 500, headers: cors });
      }
    }

    // ─── MAIN: Order create ───
    try {
      const b = await request.json();

      const cfRes = await fetch("https://api.cashfree.com/pg/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2023-08-01",
          "x-client-id": "12994501ff7180bbe19bd075ece0549921",
          "x-client-secret": "cfsk_ma_prod_f742703303f450c287d56666f95b067e_5f571f6d"
        },
        body: JSON.stringify({
          order_id: b.order_id,
          order_amount: b.amount,
          order_currency: "INR",
          customer_details: {
            customer_id: b.customer_phone,
            customer_name: b.customer_name,
            customer_phone: b.customer_phone
          },
          order_meta: {
            return_url: "https://lkostpcouriers.in/booking.html?order_id={order_id}"
          }
        })
      });

      const data = await cfRes.json();

      if (data.payment_session_id && b.order_data) {
        await fetch(`${FIREBASE_URL}/pending_orders/${b.order_id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b.order_data)
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
