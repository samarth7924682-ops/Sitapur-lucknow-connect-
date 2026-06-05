const FIREBASE_URL = "https://sitapur-express-default-rtdb.asia-southeast1.firebasedatabase.app";

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // ─── WEBHOOK: Cashfree payment confirmation ───
    if (url.pathname === "/webhook") {
      try {
        const body = await request.json();

        // Cashfree webhook me order_id aur status aata hai
        const orderId = body?.data?.order?.order_id || body?.order_id;
        const paymentStatus = body?.data?.payment?.payment_status || body?.payment_status;

        if (orderId && paymentStatus === "SUCCESS") {
          // localStorage se pending_order nahi milega (server side hai)
          // Isliye Firebase me check karte hain pending_orders node
          const pendingRes = await fetch(`${FIREBASE_URL}/pending_orders/${orderId}.json`);
          const pendingOrder = await pendingRes.json();

          if (pendingOrder) {
            // parcel_bookings me save karo
            const txnId = body?.data?.payment?.cf_payment_id || orderId;
            pendingOrder.transaction_id = String(txnId);
            pendingOrder.payment_status = "SUCCESS";

            await fetch(`${FIREBASE_URL}/parcel_bookings/${orderId}.json`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pendingOrder)
            });

            // pending_orders se delete karo
            await fetch(`${FIREBASE_URL}/pending_orders/${orderId}.json`, {
              method: "DELETE"
            });
          }
        }

        return new Response("ok", { headers: cors });
      } catch (e) {
        return new Response("webhook error: " + e.message, { status: 500, headers: cors });
      }
    }

    // ─── MAIN: Cashfree order create ───
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

      // Agar session_id mila toh pending_order Firebase me save karo
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
